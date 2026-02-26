import { useState } from 'react';
import type { TerminalDto } from 'shared/types';
import { TerminalDetailPanel } from './TerminalDetailPanel';
import { cn } from '@/lib/utils';

interface TerminalNodeProps {
  terminal: TerminalDto;
  taskName?: string;
}

/**
 * Get status color classes for terminal node
 */
function getStatusClasses(status: string): string {
  switch (status) {
    case 'running':
    case 'working':
      return 'border-green-500 bg-green-500/10';
    case 'waiting':
      return 'border-blue-500 bg-blue-500/10';
    case 'completed':
      return 'border-gray-400 bg-gray-400/10';
    case 'failed':
      return 'border-red-500 bg-red-500/10';
    case 'starting':
      return 'border-yellow-500 bg-yellow-500/10';
    default:
      return 'border-border bg-secondary';
  }
}

export function TerminalNode({ terminal, taskName }: Readonly<TerminalNodeProps>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      <button
        className={cn(
          'w-36 h-24 rounded border-2 flex flex-col items-center justify-center gap-1 transition-colors hover:bg-secondary/80',
          getStatusClasses(terminal.status)
        )}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="text-xs font-medium">{terminal.cliTypeId}</div>
        {terminal.role && (
          <div className="text-[10px] text-low truncate max-w-[120px] px-1">
            {terminal.role}
          </div>
        )}
        <div className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          terminal.status === 'running' || terminal.status === 'working' ? 'bg-green-500/20 text-green-600' :
          terminal.status === 'failed' ? 'bg-red-500/20 text-red-600' :
          terminal.status === 'completed' ? 'bg-gray-500/20 text-gray-600' :
          'bg-blue-500/20 text-blue-600'
        )}>
          {terminal.status}
        </div>
      </button>

      {expanded && (
        <div className="absolute top-full mt-2 z-10">
          <TerminalDetailPanel
            role={terminal.role ?? taskName ?? 'Terminal'}
            status={terminal.status}
            model={terminal.modelConfigId}
          />
        </div>
      )}
    </div>
  );
}
