import { useState } from 'react';
import { WorkflowSidebar } from '@/components/board/WorkflowSidebar';
import { WorkflowKanbanBoard } from '@/components/board/WorkflowKanbanBoard';
import { TerminalActivityPanel } from '@/components/board/TerminalActivityPanel';
import { StatusBar } from '@/components/board/StatusBar';

export function Board() {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  return (
    <div className="flex h-screen bg-primary">
      <WorkflowSidebar
        selectedWorkflowId={selectedWorkflowId}
        onSelectWorkflow={setSelectedWorkflowId}
      />
      <main className="flex-1 flex flex-col">
        <WorkflowKanbanBoard workflowId={selectedWorkflowId} />
        <TerminalActivityPanel />
        <StatusBar />
      </main>
    </div>
  );
}
