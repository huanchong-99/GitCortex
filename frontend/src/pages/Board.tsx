import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkflowSidebar } from '@/components/board/WorkflowSidebar';
import { WorkflowKanbanBoard } from '@/components/board/WorkflowKanbanBoard';
import { TerminalActivityPanel } from '@/components/board/TerminalActivityPanel';
import { StatusBar } from '@/components/board/StatusBar';
import { ViewHeader } from '@/components/ui-new/primitives/ViewHeader';
import { useWorkflowEvents } from '@/stores/wsStore';
import { useQueryClient } from '@tanstack/react-query';
import { workflowKeys } from '@/hooks/useWorkflows';

export function Board() {
  const { t } = useTranslation('workflow');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleRealtimeWorkflowSignal = useCallback(() => {
    if (!selectedWorkflowId) return;
    queryClient.invalidateQueries({
      queryKey: workflowKeys.byId(selectedWorkflowId),
    });
  }, [queryClient, selectedWorkflowId]);

  const workflowEventHandlers = useMemo(
    () => ({
      onWorkflowStatusChanged: handleRealtimeWorkflowSignal,
      onTaskStatusChanged: handleRealtimeWorkflowSignal,
      onTerminalStatusChanged: handleRealtimeWorkflowSignal,
      onTerminalCompleted: handleRealtimeWorkflowSignal,
      onGitCommitDetected: handleRealtimeWorkflowSignal,
    }),
    [handleRealtimeWorkflowSignal]
  );

  useWorkflowEvents(selectedWorkflowId, workflowEventHandlers);

  return (
    <div className="app-canvas flex h-full min-h-0 w-full">
      <WorkflowSidebar
        selectedWorkflowId={selectedWorkflowId}
        onSelectWorkflow={setSelectedWorkflowId}
      />
      <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pt-6 overflow-hidden">
          <ViewHeader
            eyebrow={t('board.eyebrow', { defaultValue: 'Kanban' })}
            title={t('board.title', { defaultValue: 'Workflow board' })}
            description={t('board.description', {
              defaultValue: 'Drag tasks between columns to track progress.',
            })}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            <WorkflowKanbanBoard workflowId={selectedWorkflowId} />
          </div>
        </div>
        <TerminalActivityPanel workflowId={selectedWorkflowId} />
        <StatusBar workflowId={selectedWorkflowId} />
      </main>
    </div>
  );
}
