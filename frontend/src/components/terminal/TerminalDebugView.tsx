import { useState, useRef } from 'react';
import { TerminalEmulator, type TerminalEmulatorRef } from './TerminalEmulator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Terminal } from '@/components/workflow/TerminalCard';
import type { WorkflowTask } from '@/components/workflow/PipelineView';
import { useTranslation } from 'react-i18next';

interface Props {
  tasks: (WorkflowTask & { terminals: Terminal[] })[];
  wsUrl: string;
}

/**
 * Renders the terminal debugging UI with a terminal list and active emulator.
 */
export function TerminalDebugView({ tasks, wsUrl }: Props) {
  const { t } = useTranslation('workflow');
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const terminalRef = useRef<TerminalEmulatorRef>(null);
  const defaultRoleLabel = t('terminalCard.defaultRole');

  const allTerminals = tasks.flatMap((task) =>
    task.terminals.map((terminal) => ({ ...terminal, taskName: task.name }))
  );

  const selectedTerminal = allTerminals.find((terminal) => terminal.id === selectedTerminalId);

  const getTerminalLabel = (terminal: Terminal) => {
    const role = terminal.role?.trim();
    return role ? role : `${defaultRoleLabel} ${terminal.orderIndex + 1}`;
  };

  const getStatusLabel = (status: Terminal['status']) =>
    t(`terminalDebug.status.${status}`, { defaultValue: status });

  const handleClear = () => {
    terminalRef.current?.clear();
  };

  const handleRestart = () => {
    console.log('Restart terminal:', selectedTerminalId);
  };

  return (
    <div className="flex h-full">
      <div className="w-64 border-r bg-muted/30 overflow-y-auto">
        <div className="p-4 border-b">
          <h3 className="font-semibold">{t('terminalDebug.listTitle')}</h3>
        </div>
        <div role="list" className="p-2">
          {allTerminals.map((terminal) => {
            const terminalLabel = getTerminalLabel(terminal);
            const statusLabel = getStatusLabel(terminal.status);

            return (
              <button
                key={terminal.id}
                role="listitem"
                aria-pressed={selectedTerminalId === terminal.id}
                aria-label={`${terminalLabel} - ${statusLabel}`}
                className={cn(
                  'w-full p-3 rounded-lg text-left mb-2 transition-colors',
                  selectedTerminalId === terminal.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => {
                  setSelectedTerminalId(terminal.id);
                }}
              >
                <div className="font-medium text-sm">{terminalLabel}</div>
                <div className="text-xs opacity-70">{terminal.taskName}</div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusDot status={terminal.status} />
                  <span className="text-xs">{statusLabel}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedTerminal ? (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{getTerminalLabel(selectedTerminal)}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedTerminal.cliTypeId} - {selectedTerminal.modelConfigId}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  {t('terminalDebug.clear')}
                </Button>
                <Button variant="outline" size="sm" onClick={handleRestart}>
                  {t('terminalDebug.restart')}
                </Button>
              </div>
            </div>
            <div className="flex-1 p-4">
              <TerminalEmulator
                ref={terminalRef}
                terminalId={selectedTerminal.id}
                wsUrl={wsUrl}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {t('terminalDebug.selectPrompt')}
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
