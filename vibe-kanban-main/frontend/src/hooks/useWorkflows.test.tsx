import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useWorkflows,
  useWorkflow,
  useCreateWorkflow,
  useStartWorkflow,
  useDeleteWorkflow,
  workflowKeys,
  type Workflow,
  type CreateWorkflowRequest,
} from './useWorkflows';

// Mock global fetch
let mockFetch: ReturnType<typeof vi.fn>;
global.fetch = vi.fn() as unknown as typeof fetch;

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
    {children}
  </QueryClientProvider>
);

// Mock workflows data
const mockWorkflows: Workflow[] = [
  {
    id: 'workflow-1',
    project_id: 'project-1',
    name: 'Test Workflow 1',
    description: 'Test description',
    status: 'draft',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    config: {
      tasks: [],
      models: [],
      terminals: [],
      commands: { enabled: false, presetIds: [] },
      orchestrator: {
        modelConfigId: 'model-1',
        mergeTerminal: {
          cliTypeId: 'claude-code',
          modelConfigId: 'model-1',
          runTestsBeforeMerge: true,
          pauseOnConflict: true,
        },
        targetBranch: 'main',
      },
    },
  },
  {
    id: 'workflow-2',
    project_id: 'project-1',
    name: 'Test Workflow 2',
    status: 'running',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    config: {
      tasks: [],
      models: [],
      terminals: [],
      commands: { enabled: false, presetIds: [] },
      orchestrator: {
        modelConfigId: 'model-1',
        mergeTerminal: {
          cliTypeId: 'claude-code',
          modelConfigId: 'model-1',
          runTestsBeforeMerge: true,
          pauseOnConflict: true,
        },
        targetBranch: 'main',
      },
    },
  },
];

const mockWorkflow: Workflow = {
  id: 'workflow-1',
  project_id: 'project-1',
  name: 'Test Workflow 1',
  description: 'Test description',
  status: 'draft',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  config: {
    tasks: [],
    models: [],
    terminals: [],
    commands: { enabled: false, presetIds: [] },
    orchestrator: {
      modelConfigId: 'model-1',
      mergeTerminal: {
        cliTypeId: 'claude-code',
        modelConfigId: 'model-1',
        runTestsBeforeMerge: true,
        pauseOnConflict: true,
      },
      targetBranch: 'main',
    },
  },
};

// ============================================================================
// Tests
// ============================================================================

describe('useWorkflows', () => {
  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('workflowKeys', () => {
    it('should generate correct query keys', () => {
      expect(workflowKeys.all).toEqual(['workflows']);
      expect(workflowKeys.forProject('project-1')).toEqual([
        'workflows',
        'project',
        'project-1',
      ]);
      expect(workflowKeys.byId('workflow-1')).toEqual([
        'workflows',
        'detail',
        'workflow-1',
      ]);
    });
  });

  describe('useWorkflows', () => {
    it('should fetch workflows successfully', async () => {
      const projectId = 'project-1';
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockWorkflows,
            }),
        } as Response)
      );

      const { result } = renderHook(() => useWorkflows(projectId), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockWorkflows);
    });

    it('should handle fetch errors', async () => {
      const projectId = 'project-1';
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () =>
            Promise.resolve({
              message: 'Internal Server Error',
            }),
        } as Response)
      );

      const { result } = renderHook(() => useWorkflows(projectId), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should not fetch when projectId is empty', async () => {
      const { result } = renderHook(() => useWorkflows(''), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useWorkflow', () => {
    it('should fetch single workflow successfully', async () => {
      const workflowId = 'workflow-1';
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockWorkflow,
            }),
        } as Response)
      );

      const { result } = renderHook(() => useWorkflow(workflowId), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockWorkflow);
    });

    it('should handle fetch errors', async () => {
      const workflowId = 'workflow-1';
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              message: 'Workflow not found',
            }),
        } as Response)
      );

      const { result } = renderHook(() => useWorkflow(workflowId), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should not fetch when workflowId is empty', async () => {
      const { result } = renderHook(() => useWorkflow(''), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateWorkflow', () => {
    it('should create workflow successfully', async () => {
      const createData: CreateWorkflowRequest = {
        project_id: 'project-1',
        name: 'New Workflow',
        description: 'New description',
        config: {
          tasks: [],
          models: [],
          terminals: [],
          commands: { enabled: false, presetIds: [] },
          orchestrator: {
            modelConfigId: 'model-1',
            mergeTerminal: {
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              runTestsBeforeMerge: true,
              pauseOnConflict: true,
            },
            targetBranch: 'main',
          },
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...mockWorkflow, id: 'workflow-3', ...createData },
            }),
        } as Response)
      );

      const { result } = renderHook(() => useCreateWorkflow(), { wrapper });

      result.current.mutate(createData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeDefined();
    });

    it('should handle creation errors', async () => {
      const createData: CreateWorkflowRequest = {
        project_id: 'project-1',
        name: 'New Workflow',
        config: {
          tasks: [],
          models: [],
          terminals: [],
          commands: { enabled: false, presetIds: [] },
          orchestrator: {
            modelConfigId: 'model-1',
            mergeTerminal: {
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              runTestsBeforeMerge: true,
              pauseOnConflict: true,
            },
            targetBranch: 'main',
          },
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              message: 'Invalid workflow configuration',
            }),
        } as Response)
      );

      const { result } = renderHook(() => useCreateWorkflow(), { wrapper });

      result.current.mutate(createData);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('useStartWorkflow', () => {
    it('should start workflow successfully', async () => {
      const workflowId = 'workflow-1';

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                execution_id: 'exec-1',
                workflow_id: workflowId,
                status: 'running',
                started_at: new Date().toISOString(),
              },
            }),
        } as Response)
      );

      const { result } = renderHook(() => useStartWorkflow(), { wrapper });

      result.current.mutate({ workflow_id: workflowId });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.status).toBe('running');
    });

    it('should handle start errors', async () => {
      const workflowId = 'workflow-1';

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () =>
            Promise.resolve({
              message: 'Workflow cannot be started',
            }),
        } as Response)
      );

      const { result } = renderHook(() => useStartWorkflow(), { wrapper });

      result.current.mutate({ workflow_id: workflowId });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('useDeleteWorkflow', () => {
    it('should delete workflow successfully', async () => {
      const workflowId = 'workflow-1';

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: undefined,
            }),
        } as Response)
      );

      const { result } = renderHook(() => useDeleteWorkflow(), { wrapper });

      result.current.mutate(workflowId);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('should handle deletion errors', async () => {
      const workflowId = 'workflow-1';

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () =>
            Promise.resolve({
              message: 'Workflow not found',
            }),
        } as Response)
      );

      const { result } = renderHook(() => useDeleteWorkflow(), { wrapper });

      result.current.mutate(workflowId);

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate project workflows cache on create', async () => {
      const queryClient = createMockQueryClient();
      const createData: CreateWorkflowRequest = {
        project_id: 'project-1',
        name: 'New Workflow',
        config: {
          tasks: [],
          models: [],
          terminals: [],
          commands: { enabled: false, presetIds: [] },
          orchestrator: {
            modelConfigId: 'model-1',
            mergeTerminal: {
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              runTestsBeforeMerge: true,
              pauseOnConflict: true,
            },
            targetBranch: 'main',
          },
        },
      };

      // Set initial data
      queryClient.setQueryData(workflowKeys.forProject('project-1'), mockWorkflows);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { ...mockWorkflow, id: 'workflow-3', ...createData },
            }),
        } as Response)
      );

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const testWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateWorkflow(), {
        wrapper: testWrapper,
      });

      result.current.mutate(createData);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: workflowKeys.forProject('project-1'),
      });
    });

    it('should remove workflow from cache on delete', async () => {
      const queryClient = createMockQueryClient();
      const workflowId = 'workflow-1';

      // Set initial data
      queryClient.setQueryData(workflowKeys.byId(workflowId), mockWorkflow);

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: undefined,
            }),
        } as Response)
      );

      const removeSpy = vi.spyOn(queryClient, 'removeQueries');

      const testWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteWorkflow(), {
        wrapper: testWrapper,
      });

      result.current.mutate(workflowId);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(removeSpy).toHaveBeenCalledWith({
        queryKey: workflowKeys.byId(workflowId),
      });
    });
  });
});
