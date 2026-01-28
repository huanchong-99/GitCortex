import { useState } from 'react';
import type { TerminalDto } from 'shared/types';
import { TerminalDetailPanel } from './TerminalDetailPanel';

interface TerminalNodeProps {
  terminal: TerminalDto;
}

export function TerminalNode({ terminal }: TerminalNodeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      <button
        className="w-32 h-20 rounded border border-border bg-secondary flex flex-col items-center justify-center"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="text-xs text-low">{terminal.cliTypeId}</div>
        <div className="text-xs">{terminal.status}</div>
      </button>

      {expanded && (
        <div className="absolute top-full mt-2 z-10">
          <TerminalDetailPanel
            role={terminal.role ?? 'Terminal'}
            status={terminal.status}
            model={terminal.modelConfigId}
          />
        </div>
      )}
    </div>
  );
}
