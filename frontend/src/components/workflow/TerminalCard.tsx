import React from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { CLI_TYPES, type CliTypeId } from './constants';
import { useTranslation } from 'react-i18next';

export type TerminalStatus =
  | 'not_started'
  | 'starting'
  | 'waiting'
  | 'working'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'review_passed'
  | 'review_rejected';

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

const STATUS_DOT = (
  <span aria-hidden="true" className="inline-block size-2 rounded-full bg-current" />
);

const STATUS_STYLES: Record<
  TerminalStatus,
  { icon: React.ReactNode; className: string }
> = {
  not_started: {
    icon: STATUS_DOT,
    className: 'text-low',
  },
  starting: {
    icon: STATUS_DOT,
    className: 'text-yellow-500',
  },
  waiting: {
    icon: STATUS_DOT,
    className: 'text-blue-500',
  },
  working: {
    icon: STATUS_DOT,
    className: 'text-green-500',
  },
  completed: {
    icon: <Check className="w-5 h-5 text-green-500" strokeWidth={3} />,
    className: 'text-green-500',
  },
  cancelled: {
    icon: <X className="w-5 h-5 text-red-500" strokeWidth={3} />,
    className: 'text-red-500',
  },
  review_passed: {
    icon: <Check className="w-5 h-5 text-green-500" strokeWidth={3} />,
    className: 'text-green-500',
  },
  review_rejected: {
    icon: <X className="w-5 h-5 text-red-500" strokeWidth={3} />,
    className: 'text-red-500',
  },
  failed: {
    icon: <X className="w-5 h-5 text-red-500" strokeWidth={3} />,
    className: 'text-red-500',
  },
};

interface TerminalCardProps {
  terminal: Terminal;
  onClick?: () => void;
}

/**
 * Renders a terminal summary card with status and role details.
 */
export function TerminalCard({ terminal, onClick }: TerminalCardProps) {
  const { t } = useTranslation('workflow');
  const statusStyle = STATUS_STYLES[terminal.status];
  const cliType = Object.hasOwn(CLI_TYPES, terminal.cliTypeId)
    ? CLI_TYPES[terminal.cliTypeId as CliTypeId]
    : undefined;
  const orderLabel = t('terminalCard.orderLabel', { index: terminal.orderIndex + 1 });
  const roleValue = terminal.role?.trim();
  const roleLabel = roleValue ?? t('terminalCard.defaultRole');

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-32 rounded-lg border-2 p-base flex flex-col items-center gap-half',
        'hover:shadow-md transition-shadow cursor-pointer',
        'bg-secondary border-border'
      )}
    >
      <div className={cn('flex items-center justify-center', statusStyle.className)}>
        {statusStyle.icon}
      </div>

      <div className="text-xs text-low">{orderLabel}</div>

      <div className="text-sm font-medium text-high">{roleLabel}</div>

      <div className="text-xs text-low">{cliType ? cliType.label : terminal.cliTypeId}</div>
    </button>
  );
}
