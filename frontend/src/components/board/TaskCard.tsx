import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { WorkflowTaskDto } from 'shared/types';
import { TerminalDots } from './TerminalDots';

interface TaskCardProps {
  task: WorkflowTaskDto;
}

export function TaskCard({ task }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : 'transform 150ms ease',
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-panel border border-border rounded p-3 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? 'opacity-70 ring-2 ring-brand/30 shadow-lg z-50' : ''
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="text-sm font-semibold">{task.name}</div>
      <div className="text-xs text-low">{task.branch}</div>
      <div className="mt-2">
        <TerminalDots terminalCount={task.terminals.length} />
      </div>
    </div>
  );
}
