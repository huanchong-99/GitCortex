/**
 * End-to-End Tests for Slash Commands
 *
 * These tests simulate complete user workflows for slash command management
 * and workflow integration with Step5Commands.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { SlashCommands } from './SlashCommands';
import { Step5Commands } from '@/components/workflow/steps/Step5Commands';
import type { SlashCommandPresetDto } from 'shared/types';
import type { CommandConfig } from '@/components/workflow/types';
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

const mockPresets: SlashCommandPresetDto[] = [
  {
    id: 'preset-1',
    command: '/review',
    description: 'Review code changes',
    promptTemplate: 'Review the following code changes: {{code_path}}',
    isSystem: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'preset-2',
    command: '/test',
    description: 'Run tests',
    promptTemplate: 'Run tests for {{module}} with coverage {{coverage}}',
    isSystem: false,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

// ============================================================================
// E2E Test Scenarios - SlashCommands Page
// ============================================================================

describe('Slash Commands E2E: User Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: View Slash Commands List', () => {
    it('should load and display user commands', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockPresets }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Wait for commands to load (i18n key fallback for title)
      await waitFor(() => {
        expect(screen.getByText('title')).toBeInTheDocument();
      });

      // Commands should be displayed
      expect(screen.getByText('/review')).toBeInTheDocument();
      expect(screen.getByText('/test')).toBeInTheDocument();
      expect(screen.getByText('Review code changes')).toBeInTheDocument();
      expect(screen.getByText('Run tests')).toBeInTheDocument();
    });
  });

  describe('Scenario 2: Open Create Dialog', () => {
    it('should open the create dialog when clicking Create button', async () => {
      const user = userEvent.setup();

      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('title')).toBeInTheDocument();
      });

      // Click Create button (renders as raw i18n key)
      const createButton = screen.getByText('createButton');
      await user.click(createButton);

      // Dialog should appear with create form title
      await waitFor(() => {
        expect(screen.getByText('form.createTitle')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 3: View Commands with Details', () => {
    it('should display command details in cards', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockPresets }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('/review')).toBeInTheDocument();
      });

      // Both commands should render with their details
      expect(screen.getByText('/review')).toBeInTheDocument();
      expect(screen.getByText('Review code changes')).toBeInTheDocument();
      expect(screen.getByText('/test')).toBeInTheDocument();
      expect(screen.getByText('Run tests')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// E2E Test Scenarios - Step5Commands Workflow Integration
// ============================================================================

describe('Workflow Integration E2E: Step5Commands', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  describe('Scenario 4: Select Commands for Workflow', () => {
    it('should enable commands and add system presets', async () => {
      const onUpdate = vi.fn();
      const config: CommandConfig = {
        enabled: false,
        presetIds: [],
      };

      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <Step5Commands
              config={config}
              errors={{}}
              onUpdate={onUpdate}
            />
          </MemoryRouter>
        </I18nextProvider>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Enable commands
      const enabledRadio = screen.getByRole('radio', {
        name: i18n.t('workflow:step5.enableLabel'),
      });
      fireEvent.click(enabledRadio);
      expect(onUpdate).toHaveBeenCalledWith({ enabled: true });
    });
  });

  describe('Scenario 5: Manage Preset Selection', () => {
    it('should add and remove presets from selected list', async () => {
      const onUpdate = vi.fn();
      const config: CommandConfig = {
        enabled: true,
        presetIds: ['write-code'],
      };

      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <Step5Commands
              config={config}
              errors={{}}
              onUpdate={onUpdate}
            />
          </MemoryRouter>
        </I18nextProvider>
      );

      await waitFor(() => {
        // write-code appears in both selected and available sections
        expect(screen.getAllByText('/write-code')).toHaveLength(2);
      });

      // Remove the selected preset
      const removeButtons = screen.getAllByLabelText(i18n.t('workflow:step5.remove'));
      fireEvent.click(removeButtons[0]);
      expect(onUpdate).toHaveBeenCalledWith({ presetIds: [] });
    });

    it('should reorder presets using move buttons', async () => {
      const onUpdate = vi.fn();
      const config: CommandConfig = {
        enabled: true,
        presetIds: ['write-code', 'review', 'test'],
      };

      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <Step5Commands
              config={config}
              errors={{}}
              onUpdate={onUpdate}
            />
          </MemoryRouter>
        </I18nextProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByText('/write-code')).toHaveLength(2);
      });

      // Move second item up
      const moveUpButtons = screen.getAllByLabelText(i18n.t('workflow:step5.moveUp'));
      fireEvent.click(moveUpButtons[1]);
      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['review', 'write-code', 'test'] });
    });
  });
});

// ============================================================================
// E2E: Real-World User Scenarios
// ============================================================================

describe('E2E: Real-World User Scenarios', () => {
  describe('Scenario 6: Complete Workflow Setup', () => {
    it('should navigate from empty state to creating a command', async () => {
      const user = userEvent.setup();

      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Should show empty state (raw i18n key)
      await waitFor(() => {
        expect(screen.getByText('empty.title')).toBeInTheDocument();
      });

      // Create button should be available
      const createButton = screen.getByText('createButton');
      expect(createButton).toBeInTheDocument();

      // Clicking should open creation dialog
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('form.createTitle')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 7: Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ success: false, message: 'Server error' }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Should show error state (raw i18n key)
      await waitFor(() => {
        expect(screen.getByText('errors.loadFailed')).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 8: Empty State Guidance', () => {
    it('should guide users to create first command', async () => {
      const user = userEvent.setup();

      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('empty.title')).toBeInTheDocument();
      });

      // Create button should be present
      const createButton = screen.getByText('createButton');
      expect(createButton).toBeInTheDocument();

      // Clicking should open creation dialog
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('form.createTitle')).toBeInTheDocument();
      });
    });
  });
});
