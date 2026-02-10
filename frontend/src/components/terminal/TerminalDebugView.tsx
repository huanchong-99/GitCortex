import { useState, useRef, useEffect, useCallback } from 'react';
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
  const readyTerminalIdsRef = useRef<Set<string>>(new Set());
  const [, forceUpdate] = useState({});
  const startingTerminalIdsRef = useRef<Set<string>>(new Set());
  const terminalRef = useRef<TerminalEmulatorRef>(null);
  const autoStartedRef = useRef<Set<string>>(new Set());
  const needsRestartRef = useRef<Set<string>>(new Set());
  const restartAttemptsRef = useRef<Map<string, number>>(new Map());
  const MAX_RESTART_ATTEMPTS = 3;
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

  const resetAutoStart = useCallback((terminalId: string) => {
    autoStartedRef.current.delete(terminalId);
  }, []);

  const startTerminal = useCallback(async (terminalId: string, retryAfterStop = false) => {
    // Allow multiple terminals to start in parallel
    if (startingTerminalIdsRef.current.has(terminalId)) return;
    startingTerminalIdsRef.current.add(terminalId);
    // Mark as auto-started only after confirming we can start
    autoStartedRef.current.add(terminalId);
    try {
      const response = await fetch(`/api/terminals/${terminalId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);

        // Handle 409 Conflict by stopping first, then retrying
        if (response.status === 409 && !retryAfterStop) {
          console.log('Terminal conflict, stopping and retrying...');
          startingTerminalIdsRef.current.delete(terminalId);
          try {
            await fetch(`/api/terminals/${terminalId}/stop`, { method: 'POST' });
          } catch {
            // Ignore stop errors
          }
          // Retry start after stop
          return startTerminal(terminalId, true);
        }

        console.error('Failed to start terminal:', error);
        resetAutoStart(terminalId);
        // Clear ready state on failure
        readyTerminalIdsRef.current.delete(terminalId);
        forceUpdate({});
      } else {
        console.log('Terminal started successfully');
        // Mark this terminal as ready and clear restart flag
        needsRestartRef.current.delete(terminalId);
        readyTerminalIdsRef.current.add(terminalId);
        // Note: Don't reset restart attempts here - only reset on manual restart
        // This prevents infinite loops when API succeeds but process doesn't actually start
        forceUpdate({});
      }
    } catch (error) {
      console.error('Failed to start terminal:', error);
      resetAutoStart(terminalId);
      // Clear ready state on failure
      readyTerminalIdsRef.current.delete(terminalId);
      forceUpdate({});
    } finally {
      startingTerminalIdsRef.current.delete(terminalId);
    }
  }, [resetAutoStart]);

  // Handle terminal errors - auto-restart if process is not running
  const handleTerminalError = useCallback((error: Error) => {
    console.error('Terminal error:', error.message);

    // If the error indicates the process is not running, auto-restart (with limit)
    if (error.message.includes('Terminal process not running') && selectedTerminalId) {
      const attempts = restartAttemptsRef.current.get(selectedTerminalId) || 0;
      if (attempts >= MAX_RESTART_ATTEMPTS) {
        console.error(`Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached for terminal ${selectedTerminalId}`);
        // Clear flags to show "starting" message and stop retrying
        needsRestartRef.current.add(selectedTerminalId);
        readyTerminalIdsRef.current.delete(selectedTerminalId);
        forceUpdate({});
        return;
      }

      console.log(`Terminal process not running, auto-restarting... (attempt ${attempts + 1}/${MAX_RESTART_ATTEMPTS})`);
      restartAttemptsRef.current.set(selectedTerminalId, attempts + 1);
      // Mark as needing restart to hide TerminalEmulator
      needsRestartRef.current.add(selectedTerminalId);
      // Clear ready state
      readyTerminalIdsRef.current.delete(selectedTerminalId);
      // Allow re-auto-start
      autoStartedRef.current.delete(selectedTerminalId);
      forceUpdate({});
      // Start the terminal
      void startTerminal(selectedTerminalId);
    }
  }, [selectedTerminalId, startTerminal]);

  // Auto-start terminal when selected and not yet started
  useEffect(() => {
    const selectedStatus = selectedTerminal?.status;
    if (!selectedTerminalId || !selectedStatus) return;

    // Only auto-start if terminal is not started and hasn't been auto-started before
    if (selectedStatus !== 'not_started') return;
    if (autoStartedRef.current.has(selectedTerminalId)) return;

    // Note: autoStartedRef is updated inside startTerminal after confirming it can start
    void startTerminal(selectedTerminalId);
  }, [selectedTerminalId, selectedTerminal?.status, startTerminal]);

  // Clear ready state and autoStarted when terminal status changes to failed or not_started
  useEffect(() => {
    if (!selectedTerminalId || !selectedTerminal?.status) return;

    if (['failed', 'not_started'].includes(selectedTerminal.status)) {
      if (readyTerminalIdsRef.current.has(selectedTerminalId)) {
        readyTerminalIdsRef.current.delete(selectedTerminalId);
        forceUpdate({});
      }
      // Allow re-auto-start when status returns to not_started
      if (selectedTerminal.status === 'not_started') {
        autoStartedRef.current.delete(selectedTerminalId);
      }
    }
  }, [selectedTerminalId, selectedTerminal?.status]);

  const handleRestart = async () => {
    if (!selectedTerminalId) return;
    // Reset restart attempts when user manually restarts
    restartAttemptsRef.current.delete(selectedTerminalId);
    await startTerminal(selectedTerminalId);
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
              {!needsRestartRef.current.has(selectedTerminal.id) &&
               (readyTerminalIdsRef.current.has(selectedTerminal.id) ||
                (!['failed', 'not_started'].includes(selectedTerminal.status) &&
                 ['waiting', 'working', 'running', 'active', 'completed'].includes(selectedTerminal.status))) ? (
                <TerminalEmulator
                  key={selectedTerminal.id}
                  ref={terminalRef}
                  terminalId={selectedTerminal.id}
                  wsUrl={wsUrl}
                  onError={handleTerminalError}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t('terminalDebug.starting')}
                </div>
              )}
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
