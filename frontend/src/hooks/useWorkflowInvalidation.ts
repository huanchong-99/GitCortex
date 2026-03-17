import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { workflowKeys } from '@/hooks/useWorkflows';
import { useWorkflowEvents } from '@/stores/wsStore';

/**
 * Subscribes to workflow WebSocket events and invalidates the workflow
 * React Query cache on any status change. Use in pages that display
 * workflow data and need real-time updates.
 */
export function useWorkflowInvalidation(workflowId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidateWorkflow = useCallback(() => {
    if (!workflowId) return;
    queryClient.invalidateQueries({ queryKey: workflowKeys.byId(workflowId) });
  }, [queryClient, workflowId]);

  const workflowEventHandlers = useMemo(
    () => ({
      onWorkflowStatusChanged: invalidateWorkflow,
      onTaskStatusChanged: invalidateWorkflow,
      onTerminalStatusChanged: invalidateWorkflow,
      onTerminalCompleted: invalidateWorkflow,
      onGitCommitDetected: invalidateWorkflow,
    }),
    [invalidateWorkflow]
  );

  useWorkflowEvents(workflowId, workflowEventHandlers);
}
