import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Workflows } from './Workflows';
import type { WorkflowDetailDto, WorkflowListItemDto } from 'shared/types';
import { I18nextProvider } from 'react-i18next';
import { i18n, setTestLanguage } from '@/test/renderWithI18n';
import { ToastProvider } from '@/components/ui/toast';

// Mock useProjects hook to avoid WebSocket connection in tests
vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [{ id: 'proj-1', name: 'Test Project', path: '/test' }],
    isLoading: false,
    error: null,
  }),
}));

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
  <I18nextProvider i18n={i18n}>
    <ToastProvider>
      <QueryClientProvider client={createMockQueryClient()}>
        <MemoryRouter initialEntries={['/projects/proj-1/workflows']}>
          <Routes>
            <Route path="/projects/:projectId/workflows" element={children} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ToastProvider>
  </I18nextProvider>
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
  {
    id: 'workflow-4',
    projectId: 'proj-1',
    name: 'Cancelled Workflow',
    description: 'A cancelled workflow',
    status: 'cancelled',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-04T02:00:00Z',
    tasksCount: 2,
    terminalsCount: 3,
  },
];

const mockCompletedWorkflowDetail: WorkflowDetailDto = {
  id: 'workflow-3',
  projectId: 'proj-1',
  name: 'Completed Workflow',
  description: 'A completed workflow',
  status: 'completed',
  useSlashCommands: false,
  orchestratorEnabled: false,
  orchestratorApiType: null,
  orchestratorBaseUrl: null,
  orchestratorModel: null,
  errorTerminalEnabled: false,
  errorTerminalCliId: null,
  errorTerminalModelId: null,
  mergeTerminalCliId: 'test-cli',
  mergeTerminalModelId: 'test-model',
  targetBranch: 'main',
  readyAt: null,
  startedAt: null,
  completedAt: '2024-01-03T02:00:00Z',
  createdAt: '2024-01-03T00:00:00Z',
  updatedAt: '2024-01-03T02:00:00Z',
  tasks: [
    {
      id: 'task-1',
      workflowId: 'workflow-3',
      vkTaskId: null,
      name: 'Task 1',
      description: null,
      branch: 'workflow/task-1',
      status: 'completed',
      orderIndex: 0,
      startedAt: null,
      completedAt: '2024-01-03T02:00:00Z',
      createdAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T02:00:00Z',
      terminals: [
        {
          id: 'terminal-1',
          workflowTaskId: 'task-1',
          cliTypeId: 'test-cli',
          modelConfigId: 'test-model',
          customBaseUrl: null,
          role: 'developer',
          roleDescription: null,
          orderIndex: 0,
          status: 'completed',
          createdAt: '2024-01-03T00:00:00Z',
          updatedAt: '2024-01-03T02:00:00Z',
        },
      ],
    },
  ],
  commands: [],
};

// ============================================================================
// Tests
// ============================================================================

describe('Workflows Page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setTestLanguage('en');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('List Rendering', () => {
    it('should render workflow list from API', async () => {
      // Mock fetch for workflows list
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockWorkflows }),
          } as Response)
        )
      );

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
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockWorkflows }),
          } as Response)
        )
      );

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test description')).toBeInTheDocument();
      });

      expect(screen.getByText('Another description')).toBeInTheDocument();
      expect(screen.getByText('A completed workflow')).toBeInTheDocument();
    });

    it('should display tasks and terminals count from DTO', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockWorkflows }),
          } as Response)
        )
      );

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('3 tasks')).toBeInTheDocument();
      });

      expect(screen.getByText('3 tasks')).toBeInTheDocument();
      expect(screen.getByText('6 terminals')).toBeInTheDocument();
      expect(screen.getAllByText('2 tasks').length).toBeGreaterThan(0);
      expect(screen.getByText('4 terminals')).toBeInTheDocument();
    });
  });

  describe('Status Badge', () => {
    it('should render status badges with correct styling', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockWorkflows }),
          } as Response)
        )
      );

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('draft')).toBeInTheDocument();
      });

      // Check status badges exist
      const draftBadge = screen.getByText('draft');
      const runningBadge = screen.getByText('Running');
      const completedBadge = screen.getByText('Completed');
      const cancelledBadge = screen.getByText('Cancelled');

      expect(draftBadge).toBeInTheDocument();
      expect(runningBadge).toBeInTheDocument();
      expect(completedBadge).toBeInTheDocument();
      expect(cancelledBadge).toBeInTheDocument();

      // cancelled should have neutral style instead of failed(red) style
      expect(cancelledBadge).toHaveClass('bg-zinc-100');
      expect(cancelledBadge).not.toHaveClass('bg-red-100');
    });
  });

  describe('Navigation', () => {
    it('should navigate to workflow detail when clicking a workflow card', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockWorkflows }),
          } as Response)
        )
      );

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Workflow 1')).toBeInTheDocument();
      });

      // Click on first workflow card
      const workflowCard = screen
        .getByText('Test Workflow 1')
        .closest('.cursor-pointer');
      expect(workflowCard).toBeInTheDocument();

      // Note: Full navigation test would require more setup
      // This test verifies the card is clickable
      expect(workflowCard).toHaveClass('cursor-pointer');
    });

    it('should trigger merge API from workflow detail view', async () => {
      const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();

        if (url.startsWith('/api/workflows?project_id=')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: mockWorkflows }),
          } as Response);
        }

        if (url === '/api/workflows/workflow-3/merge') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                success: true,
                message: 'Merge completed successfully',
                workflowId: 'workflow-3',
                targetBranch: 'main',
                mergedTasks: [],
              },
            }),
          } as Response);
        }

        if (url === '/api/workflows/workflow-3') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: mockCompletedWorkflowDetail,
            }),
          } as Response);
        }

        return Promise.reject(new Error(`Unexpected request: ${url}`));
      });

      vi.stubGlobal('fetch', fetchMock);

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Completed Workflow')).toBeInTheDocument();
      });

      const workflowCard = screen
        .getByText('Completed Workflow')
        .closest('.cursor-pointer');
      expect(workflowCard).toBeInTheDocument();
      fireEvent.click(workflowCard!);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Merge Workflow' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Merge Workflow' }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/workflows/workflow-3/merge',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ merge_strategy: 'squash' }),
          })
        );
      });

      await waitFor(() => {
        const detailCallCount = fetchMock.mock.calls.filter(
          ([url]) => String(url) === '/api/workflows/workflow-3'
        ).length;
        expect(detailCallCount).toBeGreaterThan(1);
      });
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no workflows exist', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: [] }),
          } as Response)
        )
      );

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('No workflows yet')).toBeInTheDocument();
      });

      expect(screen.getByText('No workflows yet')).toBeInTheDocument();
      expect(
        screen.getByText('Create Your First Workflow')
      ).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching', () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => new Promise(() => {}))
      ); // Never resolves

      render(<Workflows />, { wrapper });

      expect(screen.getByText('Loading workflows...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when fetch fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ success: false, message: 'Failed to fetch' }),
          } as Response)
        )
      );

      render(<Workflows />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to load workflows/)
        ).toBeInTheDocument();
      });
    });
  });
});
