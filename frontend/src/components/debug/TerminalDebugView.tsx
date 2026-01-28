import type { TerminalDto } from 'shared/types';
import { X } from 'lucide-react';

interface TerminalDebugViewProps {
  terminalId: string | null;
  terminals: TerminalDto[];
  onClose: () => void;
}

export function TerminalDebugView({ terminalId, terminals, onClose }: TerminalDebugViewProps) {
  const terminal = terminals.find((t) => t.id === terminalId);

  if (!terminalId || !terminal) {
    return (
      <div className="flex-1 flex items-center justify-center text-low">
        Select a terminal to view details
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-primary">
      <div className="h-16 bg-panel border-b border-border px-6 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{terminal.role}</div>
          <div className="text-xs text-low">
            Status: {terminal.status} | Model: {terminal.modelConfigId ?? 'n/a'}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded hover:bg-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 p-6">
        <div className="bg-panel border border-border rounded p-4">
          <div className="text-sm font-semibold mb-2">Terminal Details</div>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-low">CLI Type:</span> {terminal.cliTypeId}
            </div>
            <div>
              <span className="text-low">Status:</span> {terminal.status}
            </div>
            <div>
              <span className="text-low">Model:</span> {terminal.modelConfigId ?? 'n/a'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
