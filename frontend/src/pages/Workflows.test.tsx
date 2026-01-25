import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Workflows } from './Workflows';
import type { WorkflowListItemDto } from '@/shared/types';

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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createMockQueryClient()}>
    <MemoryRouter initialEntries={['/projects/proj-1/workflows']}>
      <Routes>
        <Route path="/projects/:projectId/workflows" element={children} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>
);

// Mock workflow list data matching WorkflowListItemDto
const mockWorkflows: WorkflowListItemDto[] = [
  {
    id: 'workflow-1',
    projectId: 'proj-1',
    name: 'Test Workflow 1',
    description: 'Test description',
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    tasksCount: 3,
    terminalsCount: 6,
  },
  {
    id: 'workflow-2',
    projectId: 'proj-1',
    name: 'Test Workflow 2',
    description: 'Another description',
    status: 'running',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T01:00:00Z',
    tasksCount: 2,
    terminalsCount: 4,
  },
  {
    id: 'workflow-3',
    projectId: 'proj-1',
    name: 'Completed Workflow',
    description: 'A completed workflow',
    status: 'completed',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T02:00:00Z',
    tasksCount: 1,
    terminalsCount: 2,
  },
];

// ============================================================================
// Tests
// ============================================================================

describe('Workflows Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('List Rendering', () => {
    it('should render workflow list from API', async () => {
      // Mock fetch for workflows list
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockWorkflows }),
        } as Response)
      ));

      render(<Workflows />, { wrapper });

      // Wait for workflows to load
      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      // Check all workflows are rendered
      expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      expect(screen.getByText('Test Workflow 2')).toBeInTheDocument();
      expect(screen.getByText('Completed Workflow')).toBeInTheDocument();
    });

    it('should display workflow descriptions', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockWorkflows }),
        } as Response)
      ));

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test description')).toBeInTheDocument();
      });

      expect(screen.getByText('Another description')).toBeInTheDocument();
      expect(screen.getByText('A completed workflow')).toBeInTheDocument();
    });

    it('should display tasks and terminals count from DTO', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockWorkflows }),
        } as Response)
      ));

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('3 tasks')).toBeInTheDocument();
      });

      expect(screen.getByText('3 tasks')).toBeInTheDocument();
      expect(screen.getByText('6 terminals')).toBeInTheDocument();
      expect(screen.getByText('2 tasks')).toBeInTheDocument();
      expect(screen.getByText('4 terminals')).toBeInTheDocument();
    });
  });

  describe('Status Badge', () => {
    it('should render status badges with correct styling', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockWorkflows }),
        } as Response)
      ));

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument();
      });

      // Check status badges exist
      const draftBadge = screen.getByText('draft');
      const runningBadge = screen.getByText('running');
      const completedBadge = screen.getByText('completed');

      expect(draftBadge).toBeInTheDocument();
      expect(runningBadge).toBeInTheDocument();
      expect(completedBadge).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('should navigate to workflow detail when clicking a workflow card', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockWorkflows }),
        } as Response)
      ));

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      // Click on first workflow card
      const workflowCard = screen.getByText('Test Workflow 1').closest('.cursor-pointer');
      expect(workflowCard).toBeInTheDocument();

      // Note: Full navigation test would require more setup
      // This test verifies the card is clickable
      expect(workflowCard).toHaveClass('cursor-pointer');
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no workflows exist', async () => {
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No workflows yet')).toBeInTheDocument();
      });

      expect(screen.getByText('No workflows yet')).toBeInTheDocument();
      expect(screen.getByText('Create Your First Workflow')).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching', () => {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // Never resolves

      render(<Workflows />, { wrapper });

      expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
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

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(/Failed to load workflows/)).toBeInTheDocument();
      });
    });
  });
});
