import { useEffect, useState, useRef } from 'react';
import type { PatchType } from 'shared/types';

type LogEntry = Extract<PatchType, { type: 'STDOUT' } | { type: 'STDERR' }>;
const MAX_LOG_ENTRIES = 5000;

interface UseLogStreamResult {
  logs: LogEntry[];
  error: string | null;
}

export const useLogStream = (processId: string): UseLogStreamResult => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef<number>(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isIntentionallyClosed = useRef<boolean>(false);
  // Track current processId to prevent stale WebSocket messages from contaminating logs
  const currentProcessIdRef = useRef<string>(processId);

  useEffect(() => {
    if (!processId) {
      return;
    }

    // Update the ref to track the current processId
    currentProcessIdRef.current = processId;

    // Clear logs when process changes
    setLogs([]);
    setError(null);

    const addLogEntry = (entry: LogEntry, capturedProcessId: string) => {
      // Only add log entry if this WebSocket is still for the current process
      if (currentProcessIdRef.current !== capturedProcessId) {
        return;
      }
      setLogs((prev) => {
        const next = [...prev, entry];
        if (next.length <= MAX_LOG_ENTRIES) {
          return next;
        }
        return next.slice(next.length - MAX_LOG_ENTRIES);
      });
    };

    const handleMessage = (event: MessageEvent, capturedProcessId: string) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different message types based on LogMsg enum
        if ('JsonPatch' in data) {
          const patches = data.JsonPatch as Array<{ value?: PatchType }>;
          patches.forEach((patch) => {
            const value = patch?.value;
            if (!value || !value.type) return;

            switch (value.type) {
              case 'STDOUT':
              case 'STDERR':
                addLogEntry({ type: value.type, content: value.content }, capturedProcessId);
                break;
              // Ignore other patch types (NORMALIZED_ENTRY, DIFF, etc.)
              default:
                break;
            }
          });
        } else if (data.finished === true) {
          isIntentionallyClosed.current = true;
          wsRef.current?.close();
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    const open = () => {
      // Capture processId at the time of opening the WebSocket
      const capturedProcessId = processId;
      const protocol = globalThis.window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = globalThis.window.location.host;
      const ws = new WebSocket(
        `${protocol}//${host}/api/execution-processes/${processId}/raw-logs/ws`
      );
      wsRef.current = ws;
      isIntentionallyClosed.current = false;

      ws.onopen = () => {
        // Ignore if processId has changed since WebSocket was opened
        if (currentProcessIdRef.current !== capturedProcessId) {
          ws.close();
          return;
        }
        setError(null);
        // Reset logs on new connection since server replays history
        setLogs([]);
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => handleMessage(event, capturedProcessId);

      ws.onerror = () => {
        // Ignore errors from stale WebSocket connections
        if (currentProcessIdRef.current !== capturedProcessId) {
          return;
        }
        setError('Connection failed');
      };

      ws.onclose = (event) => {
        // Don't retry for stale WebSocket connections
        if (currentProcessIdRef.current !== capturedProcessId) {
          return;
        }
        // Only retry if the close was not intentional and not a normal closure
        if (!isIntentionallyClosed.current && event.code !== 1000) {
          const next = retryCountRef.current + 1;
          retryCountRef.current = next;
          if (next <= 6) {
            const delay = Math.min(1500, 250 * 2 ** (next - 1));
            retryTimerRef.current = setTimeout(() => open(), delay);
          }
        }
      };
    };

    open();

    return () => {
      if (wsRef.current) {
        isIntentionallyClosed.current = true;
        wsRef.current.close();
        wsRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [processId]);

  return { logs, error };
};
