import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { SlashCommands } from './SlashCommands';
import type { SlashCommandPresetDto } from 'shared/types';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/test/renderWithI18n';

// ============================================================================
// Test Utilities
// ============================================================================

const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const wrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={createMockQueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  </I18nextProvider>
);

// Mock slash command data matching SlashCommandPresetDto
const mockSlashCommands: SlashCommandPresetDto[] = [
  {
    id: 'preset-1',
    command: '/test',
    description: 'Test command',
    promptTemplate: 'This is a test template',
    isSystem: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'preset-2',
    command: '/review',
    description: 'Review code',
    promptTemplate: 'Review the following code',
    isSystem: false,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'preset-3',
    command: '/system',
    description: 'System command',
    promptTemplate: 'System template',
    isSystem: true,
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('SlashCommands Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('List Rendering', () => {
    it('should render slash command list from API', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockSlashCommands }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Wait for commands to load
      await waitFor(() => {
        expect(screen.getByText('/test')).toBeInTheDocument();
      });

      // Check all non-system commands are rendered
      expect(screen.getByText('/test')).toBeInTheDocument();
      expect(screen.getByText('/review')).toBeInTheDocument();
      // System commands should not be shown
      expect(screen.queryByText('/system')).not.toBeInTheDocument();
    });

    it('should display command descriptions', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockSlashCommands }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test command')).toBeInTheDocument();
      });

      expect(screen.getByText('Test command')).toBeInTheDocument();
      expect(screen.getByText('Review code')).toBeInTheDocument();
    });

    it('should not display system commands in the main list', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockSlashCommands }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('/test')).toBeInTheDocument();
      });

      expect(screen.queryByText('/system')).not.toBeInTheDocument();
      expect(screen.queryByText('System command')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no commands exist', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/No slash commands yet/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/No slash commands yet/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching', () => {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // Never resolves

      render(<SlashCommands />, { wrapper });

      expect(screen.getByText(/Loading slash commands/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ success: false, message: 'Failed to fetch' }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load slash commands/i)).toBeInTheDocument();
      });
    });
  });

  describe('Create Dialog', () => {
    it('should have Create button in the header', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Slash Commands')).toBeInTheDocument();
      });

      expect(screen.getByText('Create Slash Command')).toBeInTheDocument();
    });

    it('should open create dialog when clicking Create button', async () => {
      const user = userEvent.setup();

      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Slash Commands')).toBeInTheDocument();
      });

      const createButton = screen.getByText('Create Slash Command');
      await user.click(createButton);

      // Dialog should appear
      await waitFor(() => {
        expect(screen.getByText(/Create Slash Command/)).toBeInTheDocument();
      });
    });
  });

  describe('Command Display', () => {
    it('should display command names with proper formatting', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockSlashCommands }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('/test')).toBeInTheDocument();
      });

      // Commands should be displayed with / prefix
      expect(screen.getByText('/test')).toBeInTheDocument();
      expect(screen.getByText('/review')).toBeInTheDocument();
    });
  });
});
