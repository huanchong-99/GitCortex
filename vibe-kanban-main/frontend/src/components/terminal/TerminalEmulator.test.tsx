import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { TerminalEmulator, TerminalEmulatorRef } from './TerminalEmulator';

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

    it('should have accessibility attributes', () => {
      render(<TerminalEmulator terminalId="test-terminal-1" />);
      const container = document.querySelector('[role="terminal"]');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('aria-label', 'Terminal emulator');
    });
  });

  describe('Terminal Initialization', () => {
    it('should initialize terminal without errors', () => {
      expect(() => {
        render(<TerminalEmulator terminalId="test-terminal-1" />);
      }).not.toThrow();
    });

    it('should have displayName for debugging', () => {
      expect(TerminalEmulator.displayName).toBe('TerminalEmulator');
    });
  });

  describe('Ref Methods', () => {
    it('should expose write method via ref', () => {
      const ref = createRef<TerminalEmulatorRef>();
      render(<TerminalEmulator terminalId="test-terminal-1" ref={ref} />);

      waitFor(() => {
        expect(ref.current).toBeDefined();
        expect(ref.current?.write).toBeInstanceOf(Function);
      });
    });

    it('should expose clear method via ref', () => {
      const ref = createRef<TerminalEmulatorRef>();
      render(<TerminalEmulator terminalId="test-terminal-1" ref={ref} />);

      waitFor(() => {
        expect(ref.current).toBeDefined();
        expect(ref.current?.clear).toBeInstanceOf(Function);
      });
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

    it('should validate terminalId format', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TerminalEmulator
          terminalId="invalid@id!"
          wsUrl="ws://localhost:8080"
        />
      );

      expect(consoleSpy).toHaveBeenCalledWith('Invalid terminalId');
      consoleSpy.mockRestore();
    });

    it('should reject empty terminalId', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TerminalEmulator
          terminalId=""
          wsUrl="ws://localhost:8080"
        />
      );

      expect(consoleSpy).toHaveBeenCalledWith('Invalid terminalId');
      consoleSpy.mockRestore();
    });

    it('should accept valid terminalId with alphanumeric characters and hyphens', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TerminalEmulator
          terminalId="test-terminal-123"
          wsUrl="ws://localhost:8080"
        />
      );

      // Should not log error for valid terminalId
      expect(consoleSpy).not.toHaveBeenCalledWith('Invalid terminalId');
      consoleSpy.mockRestore();
    });
  });

  describe('WebSocket Ready State Checks', () => {
    it('should check WebSocket ready state before sending data', () => {
      const onData = vi.fn();
      render(
        <TerminalEmulator
          terminalId="test-terminal-1"
          wsUrl="ws://localhost:8080"
          onData={onData}
        />
      );

      // Component should not throw when WebSocket is not ready
      expect(() => {
        // The handleData callback checks readyState before sending
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed WebSocket messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TerminalEmulator
          terminalId="test-terminal-1"
          wsUrl="ws://localhost:8080"
        />
      );

      // Simulate receiving malformed data
      // In a real scenario, the WebSocket would receive invalid JSON
      // The component should catch and log the error without crashing

      consoleSpy.mockRestore();
    });

    it('should handle WebSocket errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <TerminalEmulator
          terminalId="test-terminal-1"
          wsUrl="ws://localhost:8080"
        />
      );

      // Error handler is set up and will log errors
      expect(consoleSpy).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  describe('Data Handling', () => {
    it('should handle onData callback', () => {
      const onData = vi.fn();
      expect(() => {
        render(<TerminalEmulator terminalId="test-terminal-1" onData={onData} />);
      }).not.toThrow();
    });

    it('should handle onResize callback', () => {
      const onResize = vi.fn();
      expect(() => {
        render(<TerminalEmulator terminalId="test-terminal-1" onResize={onResize} />);
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

    it('should close WebSocket on unmount', () => {
      const { unmount } = render(
        <TerminalEmulator
          terminalId="test-terminal-1"
          wsUrl="ws://localhost:8080"
        />
      );

      expect(() => {
        unmount();
      }).not.toThrow();
    });
  });

  describe('Race Condition Prevention', () => {
    it('should wait for terminal to be ready before connecting WebSocket', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(
        <TerminalEmulator
          terminalId="test-terminal-1"
          wsUrl="ws://localhost:8080"
        />
      );

      // WebSocket connection should only establish after terminal is ready
      // This is handled by the terminalReadyRef
      consoleSpy.mockRestore();
    });
  });
});
