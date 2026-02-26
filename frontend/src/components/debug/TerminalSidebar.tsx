import type { TerminalDto } from 'shared/types';
import { cn } from '@/lib/utils';

interface TerminalSidebarProps {
  readonly terminals: TerminalDto[];
  readonly selectedTerminalId: string | null;
  readonly onSelect: (terminalId: string) => void;
}

export function TerminalSidebar({ terminals, selectedTerminalId, onSelect }: TerminalSidebarProps) {
  return (
    <aside className="w-64 bg-panel border-r border-border p-4">
      <div className="text-sm font-semibold mb-3">Terminals</div>
      <div className="space-y-2">
        {terminals.map((terminal) => (
          <button
            key={terminal.id}
            onClick={() => onSelect(terminal.id)}
            className={cn(
              'w-full text-left p-2 rounded border transition-colors',
              selectedTerminalId === terminal.id
                ? 'border-brand bg-brand/10'
                : 'border-border hover:bg-secondary'
            )}
          >
            <div className="text-sm font-semibold">{terminal.role}</div>
            <div className="text-xs text-low">{terminal.cliTypeId}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}
