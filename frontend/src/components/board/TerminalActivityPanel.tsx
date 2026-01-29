import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWorkflow } from '@/hooks/useWorkflows';

interface TerminalActivityPanelProps {
  workflowId: string | null;
}

interface ActivityItem {
  id: string;
  label: string;
  status: string;
  orderIndex: number;
}

export function TerminalActivityPanel({ workflowId }: TerminalActivityPanelProps) {
  const { data: workflow, isLoading } = useWorkflow(workflowId ?? '');

  const activityItems = useMemo<ActivityItem[]>(() => {
    if (!workflow) return [];

    return workflow.tasks.flatMap((task) =>
      task.terminals.map((terminal) => ({
        id: terminal.id,
        label: terminal.role?.trim() || task.name || 'Terminal',
        status: terminal.status,
        orderIndex: terminal.orderIndex,
      }))
    );
  }, [workflow]);

  return (
    <div className="h-32 bg-panel border-t border-border p-4">
      <div className="text-sm font-semibold mb-2">Terminal Activity</div>
      {!workflowId && (
        <div className="text-xs text-low">
          Select a workflow to view terminal activity.
        </div>
      )}
      {workflowId && isLoading && (
        <div className="text-xs text-low">Loading terminal activity...</div>
      )}
      {workflowId && !isLoading && activityItems.length === 0 && (
        <div className="text-xs text-low">No terminal activity yet.</div>
      )}
      {workflowId && !isLoading && activityItems.length > 0 && (
        <div className="space-y-1 text-xs font-mono">
          {activityItems.map((item) => (
            <Link
              key={item.id}
              to={`/debug/${workflowId}`}
              className="flex items-center gap-2 rounded border border-border px-2 py-1 text-left text-low transition-colors hover:bg-secondary"
            >
              <span className="text-foreground">[T{item.orderIndex + 1}]</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <span className="text-low">{item.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
