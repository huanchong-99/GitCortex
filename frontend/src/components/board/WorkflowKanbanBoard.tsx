import { DndContext, type DragEndEvent, useDroppable } from '@dnd-kit/core';
import { useWorkflow, useUpdateTaskStatus } from '@/hooks/useWorkflows';
import type { WorkflowTaskDto } from 'shared/types';
import { TaskCard } from './TaskCard';

interface WorkflowKanbanBoardProps {
  workflowId: string | null;
}

interface Column {
  id: string;
  title: string;
}

/**
 * Kanban columns matching backend WorkflowTaskStatus enum:
 * pending, running, review_pending, completed, failed, cancelled
 */
const columns: Column[] = [
  { id: 'pending', title: 'Pending' },
  { id: 'running', title: 'Running' },
  { id: 'review_pending', title: 'Review' },
  { id: 'completed', title: 'Completed' },
  { id: 'failed', title: 'Failed' },
  { id: 'cancelled', title: 'Cancelled' },
];

interface KanbanColumnProps {
  column: Column;
  tasks: WorkflowTaskDto[];
}

/**
 * Droppable column for the Kanban board
 */
function KanbanColumn({ column, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const columnTasks = tasks.filter((task) => task.status === column.id);

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${column.id}`}
      className={`bg-panel border border-border rounded p-4 transition-colors ${
        isOver ? 'ring-2 ring-brand/40 bg-brand/5' : ''
      }`}
    >
      <div className="text-sm font-semibold mb-3">
        {column.title}
        <span className="ml-2 text-low font-normal">({columnTasks.length})</span>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {columnTasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

export function WorkflowKanbanBoard({ workflowId }: WorkflowKanbanBoardProps) {
  const { data: workflow, isLoading } = useWorkflow(workflowId ?? '');
  const updateTaskStatus = useUpdateTaskStatus();

  const tasks = workflow?.tasks ?? [];

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!workflowId || !over) return;

    const taskId = String(active.id);
    const nextStatus = String(over.id);

    // Validate the target is a valid column
    if (!columns.some((column) => column.id === nextStatus)) return;

    // Find the task and check if status actually changed
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === nextStatus) return;

    // Trigger the mutation (optimistic update handled in the hook)
    updateTaskStatus.mutate({
      workflowId,
      taskId,
      status: nextStatus,
    });
  };

  if (!workflowId) {
    return <div className="p-6 text-low">Select a workflow</div>;
  }

  if (isLoading) {
    return <div className="p-6 text-low">Loading...</div>;
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex-1 p-6 grid grid-cols-6 gap-4">
        {columns.map((column) => (
          <KanbanColumn key={column.id} column={column} tasks={tasks} />
        ))}
      </div>
    </DndContext>
  );
}
