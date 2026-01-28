import type { WorkflowTaskDto } from 'shared/types';
import { TerminalDots } from './TerminalDots';

interface TaskCardProps {
  task: WorkflowTaskDto;
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="bg-panel border border-border rounded p-3">
      <div className="text-sm font-semibold">{task.name}</div>
      <div className="text-xs text-low">{task.branch}</div>
      <div className="mt-2">
        <TerminalDots terminalCount={task.terminals.length} />
      </div>
    </div>
  );
}
