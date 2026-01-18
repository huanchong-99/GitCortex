import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  terminalId: string;
  wsUrl?: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
}

export function TerminalEmulator({ terminalId, wsUrl, onData, onResize }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

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

    // Handle user input
    terminal.onData((data) => {
      onData?.(data);
      wsRef.current?.send(JSON.stringify({ type: 'input', data }));
    });

    // Handle window resize
    const handleResize = () => {
      fitAddon.fit();
      const { cols, rows } = terminal;
      onResize?.(cols, rows);
      wsRef.current?.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, [onData, onResize]);

  // WebSocket connection
  useEffect(() => {
    if (!wsUrl || !terminalRef.current) return;

    const ws = new WebSocket(`${wsUrl}/terminal/${terminalId}`);

    ws.onopen = () => {
      console.log('Terminal WebSocket connected');
      // Send initial size
      const { cols, rows } = terminalRef.current!;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'output') {
        terminalRef.current?.write(message.data);
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

  // Write data to terminal
  const write = useCallback((data: string) => {
    terminalRef.current?.write(data);
  }, []);

  // Clear terminal
  const clear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[300px] bg-[#1e1e1e] rounded-lg overflow-hidden"
    />
  );
}
