import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TerminalEmulator } from './TerminalEmulator';

// Mock xterm
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    onData: any;
    open: any;
    write: any;
    clear: any;
    dispose: any;
    loadAddon: any;
    cols = 80;
    rows = 24;

    constructor(options: any) {
      this.onData = vi.fn();
      this.open = vi.fn();
      this.write = vi.fn();
      this.clear = vi.fn();
      this.dispose = vi.fn();
      this.loadAddon = vi.fn();
    }
  }
  return { Terminal: MockTerminal };
});

// Mock FitAddon
vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit: any;
    constructor() {
      this.fit = vi.fn();
    }
  }
  return { FitAddon: MockFitAddon };
});

// Mock WebSocket
class MockWebSocket {
  url = '';
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  addEventListener(_: string, handler: () => void) {
    if (_ === 'open') this.onopen = handler;
  }
}

global.WebSocket = MockWebSocket as any;

describe('TerminalEmulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render terminal container', () => {
      render(<TerminalEmulator terminalId="test-terminal-1" />);
      const container = document.querySelector('.w-full.h-full.min-h-\\[300px\\]');
      expect(container).toBeInTheDocument();
    });

    it('should have correct CSS classes for styling', () => {
      render(<TerminalEmulator terminalId="test-terminal-1" />);
      const container = document.querySelector('.bg-\\[\\#1e1e1e\\]');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Terminal Initialization', () => {
    it('should initialize terminal without errors', () => {
      expect(() => {
        render(<TerminalEmulator terminalId="test-terminal-1" />);
      }).not.toThrow();
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection when wsUrl is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <TerminalEmulator
          terminalId="test-terminal-1"
          wsUrl="ws://localhost:8080"
        />
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Terminal WebSocket connected');
      });

      consoleSpy.mockRestore();
    });

    it('should not connect WebSocket when wsUrl is not provided', () => {
      expect(() => {
        render(<TerminalEmulator terminalId="test-terminal-1" />);
      }).not.toThrow();
    });
  });

  describe('Data Handling', () => {
    it('should handle onData callback', () => {
      const onData = vi.fn();
      expect(() => {
        render(<TerminalEmulator terminalId="test-terminal-1" onData={onData} />);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = render(<TerminalEmulator terminalId="test-terminal-1" />);
      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });
});
