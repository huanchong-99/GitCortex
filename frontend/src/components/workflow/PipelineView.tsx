import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TerminalCard, type Terminal } from './TerminalCard';
import { useTranslation } from 'react-i18next';

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
const STATUS_STYLES: Record<WorkflowStatus, { className: string }> = {
  idle: { className: 'bg-secondary text-low' },
  running: { className: 'bg-blue-500/20 text-blue-500 border-blue-500' },
  paused: { className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500' },
  completed: { className: 'bg-green-500/20 text-green-500 border-green-500' },
  failed: { className: 'bg-red-500/20 text-red-500 border-red-500' },
};

const STATUS_LABEL_KEYS: Record<WorkflowStatus, string> = {
  idle: 'pipeline.status.idle',
  running: 'pipeline.status.running',
  paused: 'pipeline.status.paused',
  completed: 'pipeline.status.completed',
  failed: 'pipeline.status.failed',
};

/**
 * Renders the workflow pipeline view with task terminals and status.
 */
export function PipelineView({
  name,
  status,
  tasks,
  mergeTerminal,
  onTerminalClick,
  onMergeTerminalClick,
}: PipelineViewProps) {
  const { t } = useTranslation('workflow');
  const statusStyle = STATUS_STYLES[status];
  const statusLabel = t(STATUS_LABEL_KEYS[status]);

  return (
    <div className="w-full space-y-8">
      {/* Header: Workflow Name and Status Badge */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-high">{name}</h2>
        <Badge
          variant="outline"
          className={cn('border', statusStyle.className)}
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Tasks with Terminals */}
      <div className="space-y-6">
        {tasks.map((task, taskIndex) => (
          <div key={task.id} className="space-y-3">
            {/* Task Info: Number, Name, Branch Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-low">
                {t('pipeline.taskLabel', { index: taskIndex + 1 })}
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
                  role: t('pipeline.mergeTerminalRole'),
                  status: mergeTerminal.status,
                }}
                onClick={onMergeTerminalClick}
          />
        </div>
      </div>
    </div>
  );
}
