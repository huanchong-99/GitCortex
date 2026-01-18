import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { CLI_TYPES } from './constants';

/** Terminal runtime status */
export type TerminalStatus =
  | 'not_started'
  | 'starting'
  | 'waiting'
  | 'working'
  | 'completed'
  | 'failed';

/** Runtime terminal data with status */
export interface Terminal {
  id: string;
  workflowTaskId?: string;
  cliTypeId: string;
  modelConfigId?: string;
  role?: string;
  orderIndex: number;
  status: TerminalStatus;
  processId?: number | null;
  ptySessionId?: string | null;
}

/** Status styles for each terminal state */
const STATUS_STYLES: Record<
  TerminalStatus,
  { icon: React.ReactNode; className: string }
> = {
  not_started: {
    icon: <span className="text-lg">○</span>,
    className: 'text-low',
  },
  starting: {
    icon: <span className="text-lg">◐</span>,
    className: 'text-yellow-500',
  },
  waiting: {
    icon: <span className="text-lg">◑</span>,
    className: 'text-blue-500',
  },
  working: {
    icon: <span className="text-lg">●</span>,
    className: 'text-green-500',
  },
  completed: {
    icon: <Check className="w-5 h-5 text-green-500" weight="bold" />,
    className: 'text-green-500',
  },
  failed: {
    icon: <X className="w-5 h-5 text-red-500" weight="bold" />,
    className: 'text-red-500',
  },
};

interface TerminalCardProps {
  terminal: Terminal;
  onClick?: () => void;
}

export function TerminalCard({ terminal, onClick }: TerminalCardProps) {
  const statusStyle = STATUS_STYLES[terminal.status];
  const cliType = CLI_TYPES[terminal.cliTypeId as keyof typeof CLI_TYPES];

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-32 rounded-lg border-2 p-base flex flex-col items-center gap-half',
        'hover:shadow-md transition-shadow cursor-pointer',
        'bg-secondary border-border'
      )}
    >
      {/* Status Icon */}
      <div className={cn('flex items-center justify-center', statusStyle.className)}>
        {statusStyle.icon}
      </div>

      {/* Terminal Order Index */}
      <div className="text-xs text-low">T{terminal.orderIndex + 1}</div>

      {/* Role Name or 'Terminal' */}
      <div className="text-sm font-medium text-high">
        {terminal.role || 'Terminal'}
      </div>

      {/* CLI Type ID */}
      <div className="text-xs text-low">{cliType?.label || terminal.cliTypeId}</div>
    </div>
  );
}
