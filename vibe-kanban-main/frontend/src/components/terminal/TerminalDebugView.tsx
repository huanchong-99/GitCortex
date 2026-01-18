import { useState } from 'react';
import { TerminalEmulator } from './TerminalEmulator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Terminal, WorkflowTask } from '@/shared/types';

interface Props {
  tasks: Array<WorkflowTask & { terminals: Terminal[] }>;
  wsUrl: string;
}

export function TerminalDebugView({ tasks, wsUrl }: Props) {
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);

  const allTerminals = tasks.flatMap(task =>
    task.terminals.map(t => ({ ...t, taskName: task.name }))
  );

  const selectedTerminal = allTerminals.find(t => t.id === selectedTerminalId);

  return (
    <div className="flex h-full">
      {/* Terminal List */}
      <div className="w-64 border-r bg-muted/30 overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="font-semibold">终端列表</h3>
        </div>
        <div role="list" className="p-2">
          {allTerminals.map((terminal) => (
            <button
              key={terminal.id}
              role="listitem"
              aria-pressed={selectedTerminalId === terminal.id}
              aria-label={`${terminal.role || `Terminal ${terminal.orderIndex + 1}`} - ${terminal.status}`}
              className={cn(
                'w-full p-3 rounded-lg text-left mb-2 transition-colors',
                selectedTerminalId === terminal.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
              onClick={() => setSelectedTerminalId(terminal.id)}
            >
              <div className="font-medium text-sm">
                {terminal.role || `Terminal ${terminal.orderIndex + 1}`}
              </div>
              <div className="text-xs opacity-70">{terminal.taskName}</div>
              <div className="flex items-center gap-2 mt-1">
                <StatusDot status={terminal.status} />
                <span className="text-xs">{terminal.status}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Terminal View */}
      <div className="flex-1 flex flex-col">
        {selectedTerminal ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  {selectedTerminal.role || `Terminal ${selectedTerminal.orderIndex + 1}`}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTerminal.cliTypeId} - {selectedTerminal.modelConfigId}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">清空</Button>
                <Button variant="outline" size="sm">重启</Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <TerminalEmulator
                terminalId={selectedTerminal.id}
                wsUrl={wsUrl}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            选择一个终端开始调试
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    not_started: 'bg-gray-400',
    starting: 'bg-yellow-400',
    waiting: 'bg-blue-400',
    working: 'bg-green-400 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };

  return <div className={cn('w-2 h-2 rounded-full', colors[status] || 'bg-gray-400')} />;
}
