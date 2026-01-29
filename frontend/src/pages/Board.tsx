import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WorkflowSidebar } from '@/components/board/WorkflowSidebar';
import { WorkflowKanbanBoard } from '@/components/board/WorkflowKanbanBoard';
import { TerminalActivityPanel } from '@/components/board/TerminalActivityPanel';
import { StatusBar } from '@/components/board/StatusBar';
import { ViewHeader } from '@/components/ui-new/primitives/ViewHeader';

export function Board() {
  const { t } = useTranslation('workflow');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  return (
    <div className="app-canvas flex h-screen w-full">
      <WorkflowSidebar
        selectedWorkflowId={selectedWorkflowId}
        onSelectWorkflow={setSelectedWorkflowId}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pt-6">
          <ViewHeader
            eyebrow={t('board.eyebrow', { defaultValue: 'Kanban' })}
            title={t('board.title', { defaultValue: 'Workflow board' })}
            description={t('board.description', {
              defaultValue: 'Drag tasks between columns to track progress.',
            })}
          />
          <div className="min-h-0 flex-1">
            <WorkflowKanbanBoard workflowId={selectedWorkflowId} />
          </div>
        </div>
        <TerminalActivityPanel />
        <StatusBar />
      </main>
    </div>
  );
}
