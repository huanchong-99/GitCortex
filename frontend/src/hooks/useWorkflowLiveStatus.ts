import { useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkflow, workflowKeys } from '@/hooks/useWorkflows';
import {
  useWorkflowEvents,
  type GitCommitPayload,
  type TaskStatusPayload,
  type TerminalStatusPayload,
  type WorkflowStatusPayload,
} from '@/stores/wsStore';

/**
 * A single event entry displayed in the live progress timeline.
 */
export interface LiveEvent {
  id: string;
  type: 'git_commit' | 'task_status' | 'terminal_status' | 'workflow_status';
  timestamp: string;
  summary: string;
}

const MAX_EVENTS = 50;

/**
 * Hook that provides live workflow execution data by combining React Query
 * polling with WebSocket event subscriptions.
 *
 * Follows the same debounced-invalidation pattern used in Board.tsx (300ms).
 */
export function useWorkflowLiveStatus(workflowId: string | null) {
  const queryClient = useQueryClient();
  const eventsRef = useRef<LiveEvent[]>([]);
  // Force re-render counter — incremented when eventsRef changes
  const renderTickRef = useRef(0);

  const {
    data: workflow,
    isLoading,
  } = useWorkflow(workflowId ?? '', {
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  // --- Debounced cache invalidation (same pattern as Board.tsx) ---
  const invalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedInvalidate = useCallback(() => {
    if (!workflowId) return;
    if (invalidationTimerRef.current) {
      clearTimeout(invalidationTimerRef.current);
    }
    invalidationTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: workflowKeys.byId(workflowId),
      });
      invalidationTimerRef.current = null;
    }, 300);
  }, [queryClient, workflowId]);

  const pushEvent = useCallback(
    (event: Omit<LiveEvent, 'id' | 'timestamp'>) => {
      const entry: LiveEvent = {
        ...event,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
      };
      const next = [entry, ...eventsRef.current].slice(0, MAX_EVENTS);
      eventsRef.current = next;
      renderTickRef.current += 1;
    },
    [],
  );

  // --- WebSocket event handlers ---
  const handlers = useMemo(
    () => ({
      onWorkflowStatusChanged: (payload: WorkflowStatusPayload) => {
        pushEvent({
          type: 'workflow_status',
          summary: `Workflow ${payload.status}`,
        });
        debouncedInvalidate();
      },
      onTaskStatusChanged: (payload: TaskStatusPayload) => {
        pushEvent({
          type: 'task_status',
          summary: `Task ${payload.taskId.slice(0, 8)} ${payload.status}`,
        });
        debouncedInvalidate();
      },
      onTerminalStatusChanged: (payload: TerminalStatusPayload) => {
        pushEvent({
          type: 'terminal_status',
          summary: `Terminal ${payload.terminalId.slice(0, 8)} ${payload.status}`,
        });
        debouncedInvalidate();
      },
      onTerminalCompleted: () => {
        debouncedInvalidate();
      },
      onGitCommitDetected: (payload: GitCommitPayload) => {
        const shortHash = payload.commitHash.slice(0, 7);
        const shortMsg = payload.message.length > 60
          ? `${payload.message.slice(0, 57)}...`
          : payload.message;
        pushEvent({
          type: 'git_commit',
          summary: `${shortHash} ${shortMsg}`,
        });
        debouncedInvalidate();
      },
    }),
    [pushEvent, debouncedInvalidate],
  );

  const { connectionStatus } = useWorkflowEvents(workflowId, handlers);

  const workflowStatus = workflow?.status ?? null;
  const tasks = workflow?.tasks ?? [];
  // Read from ref + renderTick to get latest events while keeping a stable reference shape
  const _tick = renderTickRef.current;
  void _tick;
  const events = eventsRef.current;

  return {
    workflowStatus,
    tasks,
    events,
    isLoading,
    connectionStatus,
  };
}
