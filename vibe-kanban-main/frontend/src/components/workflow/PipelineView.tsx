import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TerminalCard, type Terminal } from './TerminalCard';

/** Workflow runtime status */
export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed';

/** Runtime task data with terminals */
export interface WorkflowTask {
  id: string;
  name: string;
  branch: string;
  terminals: Terminal[];
}

/** Merge terminal configuration */
export interface MergeTerminal {
  cliTypeId: string;
  modelConfigId: string;
  status: Terminal['status'];
}

interface PipelineViewProps {
  /** Workflow name */
  name: string;
  /** Current workflow status */
  status: WorkflowStatus;
  /** Array of tasks with their terminals */
  tasks: WorkflowTask[];
  /** Merge terminal configuration */
  mergeTerminal: MergeTerminal;
  /** Optional click handler for terminals */
  onTerminalClick?: (taskId: string, terminalId: string) => void;
  /** Optional click handler for merge terminal */
  onMergeTerminalClick?: () => void;
}

/** Status badge styles */
const STATUS_STYLES: Record<
  WorkflowStatus,
  { label: string; className: string }
> = {
  idle: { label: '未开始', className: 'bg-secondary text-low' },
  running: { label: '运行中', className: 'bg-blue-500/20 text-blue-500 border-blue-500' },
  paused: { label: '已暂停', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500' },
  completed: { label: '已完成', className: 'bg-green-500/20 text-green-500 border-green-500' },
  failed: { label: '失败', className: 'bg-red-500/20 text-red-500 border-red-500' },
};

export function PipelineView({
  name,
  status,
  tasks,
  mergeTerminal,
  onTerminalClick,
  onMergeTerminalClick,
}: PipelineViewProps) {
  const statusStyle = STATUS_STYLES[status];

  return (
    <div className="w-full space-y-8">
      {/* Header: Workflow Name and Status Badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-high">{name}</h2>
        <Badge
          variant="outline"
          className={cn('border', statusStyle.className)}
        >
          {statusStyle.label}
        </Badge>
      </div>

      {/* Tasks with Terminals */}
      <div className="space-y-6">
        {tasks.map((task, taskIndex) => (
          <div key={task.id} className="space-y-3">
            {/* Task Info: Number, Name, Branch Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-low">
                Task {taskIndex + 1}
              </span>
              <span className="text-base font-semibold text-normal">
                {task.name}
              </span>
              <Badge
                variant="outline"
                className="ml-auto bg-secondary text-low border-border"
              >
                {task.branch}
              </Badge>
            </div>

            {/* Terminals Row */}
            <div className="flex items-center gap-2">
              {task.terminals.map((terminal, terminalIndex) => (
                <React.Fragment key={terminal.id}>
                  {/* Terminal Card */}
                  <TerminalCard
                    terminal={terminal}
                    onClick={() =>
                      onTerminalClick?.(task.id, terminal.id)
                    }
                  />

                  {/* Connector Line (between terminals) */}
                  {terminalIndex < task.terminals.length - 1 && (
                    <div className="w-8 h-0.5 bg-muted/30 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Merge Terminal (Dashed Border Box) */}
      <div className="border-2 border-dashed border-border rounded-lg p-6 bg-secondary/50">
        <div className="flex items-center justify-center">
          <TerminalCard
            terminal={{
              id: 'merge-terminal',
              orderIndex: -1,
              cliTypeId: mergeTerminal.cliTypeId,
              role: 'Merge Terminal',
              status: mergeTerminal.status,
            }}
            onClick={onMergeTerminalClick}
          />
        </div>
      </div>
    </div>
  );
}
