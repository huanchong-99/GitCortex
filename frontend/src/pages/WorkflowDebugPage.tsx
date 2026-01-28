import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useWorkflow } from '@/hooks/useWorkflows';
import { TerminalSidebar } from '@/components/debug/TerminalSidebar';
import { TerminalDebugView } from '@/components/debug/TerminalDebugView';

export function WorkflowDebugPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { data: workflow, isLoading } = useWorkflow(workflowId ?? '');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);

  if (isLoading) return <div className="p-6 text-low">Loading...</div>;
  if (!workflow) return <div className="p-6 text-low">Workflow not found</div>;

  const terminals = workflow.terminals ?? [];

  return (
    <div className="flex h-screen bg-primary">
      <TerminalSidebar
        terminals={terminals}
        selectedTerminalId={selectedTerminalId}
        onSelect={setSelectedTerminalId}
      />
      <TerminalDebugView
        terminalId={selectedTerminalId}
        terminals={terminals}
        onClose={() => setSelectedTerminalId(null)}
      />
    </div>
  );
}
