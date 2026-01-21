import { describe, it, expect, beforeEach, vi } from 'vitest';
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

// Helper to create successful API response
const createSuccessResponse = (data: unknown) => ({
  ok: true,
  json: async () => ({ success: true, data }),
} as Response);

// Helper to create error API response
const createErrorResponse = (message: string, status: number = 500) => ({
  ok: false,
  status,
  statusText: message,
  json: async () => ({ success: false, message }),
} as Response);

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
    description: 'Another description',
    status: 'running',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T01:00:00Z',
    config: {
      tasks: [],
      models: [],
      terminals: [],
      commands: { enabled: false, presetIds: [] },
      orchestrator: {
        modelConfigId: 'model-2',
        mergeTerminal: {
          cliTypeId: 'claude-code',
          modelConfigId: 'model-2',
          runTestsBeforeMerge: false,
          pauseOnConflict: false,
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
    vi.clearAllMocks();
  });

  it('should fetch workflows for a project', async () => {
    vi.stubGlobal('fetch', vi.fn(() => createSuccessResponse(mockWorkflows)));

    const { result } = renderHook(() => useWorkflows('proj-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockWorkflows);
  });

  it('should handle fetch errors', async () => {
    vi.stubGlobal('fetch', vi.fn(() => createErrorResponse('Network error')));

    const { result } = renderHook(() => useWorkflows('proj-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('should be disabled when projectId is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(() => createSuccessResponse(mockWorkflows)));

    const { result } = renderHook(() => useWorkflows(''), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single workflow by ID', async () => {
    vi.stubGlobal('fetch', vi.fn(() => createSuccessResponse(mockWorkflow)));

    const { result } = renderHook(() => useWorkflow('workflow-1'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockWorkflow);
  });

  it('should be disabled when workflowId is empty', async () => {
    vi.stubGlobal('fetch', vi.fn(() => createSuccessResponse(mockWorkflow)));

    const { result } = renderHook(() => useWorkflow(''), {
      wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new workflow', async () => {
    const newWorkflow: Workflow = {
      ...mockWorkflow,
      id: 'new-workflow',
    };

    const requestData: CreateWorkflowRequest = {
      project_id: 'project-1',
      name: 'New Workflow',
      description: 'New description',
      config: mockWorkflow.config,
    };

    vi.stubGlobal('fetch', vi.fn(() => createSuccessResponse(newWorkflow)));

    const { result } = renderHook(() => useCreateWorkflow(), {
      wrapper,
    });

    result.current.mutate(requestData);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(newWorkflow);
  });

  it('should handle creation errors', async () => {
    const requestData: CreateWorkflowRequest = {
      project_id: 'project-1',
      name: 'New Workflow',
      config: mockWorkflow.config,
    };

    vi.stubGlobal('fetch', vi.fn(() => createErrorResponse('Creation failed')));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useCreateWorkflow(), {
      wrapper,
    });

    result.current.mutate(requestData);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('useStartWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start a workflow execution', async () => {
    const executionResponse = {
      execution_id: 'exec-1',
      workflow_id: 'workflow-1',
      status: 'running' as const,
      started_at: '2024-01-01T00:00:00Z',
    };

    vi.stubGlobal('fetch', vi.fn(() => createSuccessResponse(executionResponse)));

    const { result } = renderHook(() => useStartWorkflow(), {
      wrapper,
    });

    result.current.mutate({ workflow_id: 'workflow-1' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(executionResponse);
  });
});

describe('useDeleteWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a workflow', async () => {
    vi.stubGlobal('fetch', vi.fn(() => createSuccessResponse(undefined)));

    const { result } = renderHook(() => useDeleteWorkflow(), {
      wrapper,
    });

    result.current.mutate('workflow-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
