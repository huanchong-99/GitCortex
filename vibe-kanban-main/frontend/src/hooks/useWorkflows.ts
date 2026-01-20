import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { handleApiResponse, logApiError } from '@/lib/api';

// ============================================================================
// Workflow Types
// ============================================================================

export interface Workflow {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  config: WorkflowConfig;
  status: 'draft' | 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface WorkflowConfig {
  tasks: WorkflowTaskConfig[];
  models: WorkflowModelConfig[];
  terminals: WorkflowTerminalConfig[];
  commands: WorkflowCommandConfig;
  orchestrator: WorkflowOrchestratorConfig;
}

export interface WorkflowTaskConfig {
  id: string;
  name: string;
  description: string;
  branch: string;
  terminalCount: number;
}

export interface WorkflowModelConfig {
  id: string;
  displayName: string;
  apiType: 'anthropic' | 'google' | 'openai' | 'openai-compatible';
  baseUrl: string;
  modelId: string;
  isVerified: boolean;
}

export interface WorkflowTerminalConfig {
  id: string;
  taskId: string;
  orderIndex: number;
  cliTypeId: string;
  modelConfigId: string;
  role?: string;
}

export interface WorkflowCommandConfig {
  enabled: boolean;
  presetIds: string[];
}

export interface WorkflowOrchestratorConfig {
  modelConfigId: string;
  errorTerminal?: {
    enabled: boolean;
    cliTypeId?: string;
    modelConfigId?: string;
  };
  mergeTerminal: {
    cliTypeId: string;
    modelConfigId: string;
    runTestsBeforeMerge: boolean;
    pauseOnConflict: boolean;
  };
  targetBranch: string;
}

export interface CreateWorkflowRequest {
  project_id: string;
  name: string;
  description?: string;
  config: WorkflowConfig;
}

export interface StartWorkflowRequest {
  workflow_id: string;
}

export interface WorkflowExecution {
  execution_id: string;
  workflow_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at?: string;
  error?: string;
}

// ============================================================================
// Query Keys
// ============================================================================

export const workflowKeys = {
  all: ['workflows'] as const,
  forProject: (projectId: string) => ['workflows', 'project', projectId] as const,
  byId: (workflowId: string) => ['workflows', 'detail', workflowId] as const,
};

// ============================================================================
// Workflow API
// ============================================================================

const workflowsApi = {
  /**
   * Get all workflows for a project
   */
  getForProject: async (projectId: string): Promise<Workflow[]> => {
    const response = await fetch(`/api/workflows?project_id=${encodeURIComponent(projectId)}`);
    return handleApiResponse<Workflow[]>(response);
  },

  /**
   * Get a single workflow by ID
   */
  getById: async (workflowId: string): Promise<Workflow> => {
    const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}`);
    return handleApiResponse<Workflow>(response);
  },

  /**
   * Create a new workflow
   */
  create: async (data: CreateWorkflowRequest): Promise<Workflow> => {
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleApiResponse<Workflow>(response);
  },

  /**
   * Start a workflow execution
   */
  start: async (data: StartWorkflowRequest): Promise<WorkflowExecution> => {
    const response = await fetch(`/api/workflows/${encodeURIComponent(data.workflow_id)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return handleApiResponse<WorkflowExecution>(response);
  },

  /**
   * Delete a workflow
   */
  delete: async (workflowId: string): Promise<void> => {
    const response = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}`, {
      method: 'DELETE',
    });
    return handleApiResponse<void>(response);
  },
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all workflows for a project
 * @param projectId - The project ID to fetch workflows for
 * @returns Query result with workflows array
 */
export function useWorkflows(projectId: string): UseQueryResult<Workflow[], Error> {
  return useQuery({
    queryKey: workflowKeys.forProject(projectId),
    queryFn: () => workflowsApi.getForProject(projectId),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single workflow by ID
 * @param workflowId - The workflow ID to fetch
 * @returns Query result with workflow details
 */
export function useWorkflow(workflowId: string): UseQueryResult<Workflow, Error> {
  return useQuery({
    queryKey: workflowKeys.byId(workflowId),
    queryFn: () => workflowsApi.getById(workflowId),
    enabled: !!workflowId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to create a new workflow
 * @returns Mutation object for creating workflows
 */
export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkflowRequest) => workflowsApi.create(data),
    onSuccess: (newWorkflow, variables) => {
      // Invalidate the project's workflows list
      queryClient.invalidateQueries({
        queryKey: workflowKeys.forProject(variables.project_id),
      });
      // Add the new workflow to the cache
      queryClient.setQueryData(
        workflowKeys.byId(newWorkflow.id),
        newWorkflow
      );
    },
    onError: (error) => {
      logApiError('Failed to create workflow:', error);
    },
  });
}

/**
 * Hook to start a workflow execution
 * @returns Mutation object for starting workflows
 */
export function useStartWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartWorkflowRequest) => workflowsApi.start(data),
    onSuccess: (_result, variables) => {
      // Invalidate the workflow detail to reflect the new status
      queryClient.invalidateQueries({
        queryKey: workflowKeys.byId(variables.workflow_id),
      });
    },
    onError: (error) => {
      logApiError('Failed to start workflow:', error);
    },
  });
}

/**
 * Hook to delete a workflow
 * @returns Mutation object for deleting workflows
 */
export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workflowId: string) => workflowsApi.delete(workflowId),
    onSuccess: (_, workflowId) => {
      // Remove the workflow from the cache
      queryClient.removeQueries({
        queryKey: workflowKeys.byId(workflowId),
      });
      // Invalidate all workflows queries (we don't have project_id here)
      queryClient.invalidateQueries({
        queryKey: workflowKeys.all,
      });
    },
    onError: (error) => {
      logApiError('Failed to delete workflow:', error);
    },
  });
}
