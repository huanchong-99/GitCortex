import { useWorkflow } from '@/hooks/useWorkflows';
import { TaskCard } from './TaskCard';

interface WorkflowKanbanBoardProps {
  workflowId: string | null;
}

const columns = [
  { id: 'created', title: 'Created' },
  { id: 'ready', title: 'Ready' },
  { id: 'running', title: 'Running' },
  { id: 'completed', title: 'Completed' },
];

export function WorkflowKanbanBoard({ workflowId }: WorkflowKanbanBoardProps) {
  const { data: workflow, isLoading } = useWorkflow(workflowId ?? '');

  if (!workflowId) {
    return <div className="p-6 text-low">Select a workflow</div>;
  }

  if (isLoading) {
    return <div className="p-6 text-low">Loading...</div>;
  }

  const tasks = workflow?.tasks ?? [];

  return (
    <div className="flex-1 p-6 grid grid-cols-4 gap-4">
      {columns.map((column) => (
        <div
          key={column.id}
          data-testid={`kanban-column-${column.id}`}
          className="bg-panel border border-border rounded p-4"
        >
          <div className="text-sm font-semibold mb-3">{column.title}</div>
          <div className="space-y-2">
            {tasks
              .filter((task) => task.status === column.id)
              .map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
