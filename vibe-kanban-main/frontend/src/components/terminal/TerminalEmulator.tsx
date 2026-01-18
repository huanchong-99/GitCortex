import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  terminalId: string;
  wsUrl?: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface TerminalEmulatorRef {
  write: (data: string) => void;
  clear: () => void;
}

export const TerminalEmulator = forwardRef<TerminalEmulatorRef, Props>(
  ({ terminalId, wsUrl, onData, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const terminalReadyRef = useRef(false);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        terminalRef.current?.write(data);
      },
      clear: () => {
        terminalRef.current?.clear();
      },
    }));

    // Stable handlers
    const handleData = useCallback((data: string) => {
      onData?.(data);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    }, [onData]);

    const handleResize = useCallback((cols: number, rows: number) => {
      onResize?.(cols, rows);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    }, [onResize]);

    // Initialize terminal
    useEffect(() => {
      if (!containerRef.current) return;

      const terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          selectionBackground: '#264f78',
        },
        scrollback: 10000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      terminal.open(containerRef.current);
      fitAddon.fit();

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      terminalReadyRef.current = true;

      // Handle user input
      terminal.onData(handleData);

      // Handle window resize
      const handleWindowResize = () => {
        fitAddon.fit();
        const { cols, rows } = terminal;
        handleResize(cols, rows);
      };

      window.addEventListener('resize', handleWindowResize);

      return () => {
        window.removeEventListener('resize', handleWindowResize);
        terminalReadyRef.current = false;
        terminal.dispose();
      };
    }, [handleData, handleResize]);

    // WebSocket connection
    useEffect(() => {
      if (!wsUrl || !terminalReadyRef.current) return;

      // Basic validation
      if (!terminalId || !/^[a-zA-Z0-9-]+$/.test(terminalId)) {
        console.error('Invalid terminalId');
        return;
      }

      const ws = new WebSocket(`${wsUrl}/terminal/${terminalId}`);

      ws.onopen = () => {
        console.log('Terminal WebSocket connected');
        if (terminalRef.current) {
          const { cols, rows } = terminalRef.current;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'output' && typeof message.data === 'string') {
            terminalRef.current?.write(message.data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Terminal WebSocket closed');
      };

      wsRef.current = ws;

      return () => {
        ws.close();
      };
    }, [wsUrl, terminalId]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px] bg-[#1e1e1e] rounded-lg overflow-hidden"
        role="terminal"
        aria-label="Terminal emulator"
      />
    );
  }
);

TerminalEmulator.displayName = 'TerminalEmulator';
