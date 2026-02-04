import { useWorkflowStore } from '@/stores/workflowStore';
import { useWsStore } from '@/stores/wsStore';

interface StatusBarProps {
  workflowId: string | null;
}

export function StatusBar({ workflowId }: StatusBarProps) {
  const workflow = useWorkflowStore((state) =>
    workflowId ? state.workflows.get(workflowId) : undefined
  );
  const connectionStatus = useWsStore((state) => state.connectionStatus);

  // Count running terminals across all tasks
  // Note: Backend uses 'working' for active terminals, frontend may also see 'running'
  const runningTerminalsCount =
    workflow?.tasks.reduce((count, task) => {
      return count + task.terminals.filter(
        (t) => t.status === 'working' || t.status === 'running'
      ).length;
    }, 0) ?? 0;

  // Map connection status to display text
  const gitStatusText: Record<typeof connectionStatus, string> = {
    connected: 'Listening',
    connecting: 'Connecting...',
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
  };

  // Determine orchestrator status based on workflow
  const orchestratorStatus = workflow?.orchestratorEnabled ? 'Active' : 'Inactive';

  return (
    <div className="h-8 bg-panel border-t border-border px-4 flex items-center text-xs">
      <span className={workflow?.orchestratorEnabled ? 'text-brand' : 'text-low'}>
        Orchestrator {orchestratorStatus}
      </span>
      <span className="ml-4">{runningTerminalsCount} Terminals Running</span>
      <span className="ml-4">Tokens: N/A</span>
      <span className="ml-4">Git: {gitStatusText[connectionStatus]}</span>
    </div>
  );
}
