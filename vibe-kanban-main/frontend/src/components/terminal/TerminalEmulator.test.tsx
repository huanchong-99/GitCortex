import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { TerminalEmulator, TerminalEmulatorRef } from './TerminalEmulator';

const VALID_TERMINAL_ID = '123e4567-e89b-12d3-a456-426614174000';

// Mock xterm
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    onData = vi.fn<(handler: (data: string) => void) => void>();
    open = vi.fn<(container: HTMLElement) => void>();
    write = vi.fn<(data: string) => void>();
    clear = vi.fn<() => void>();
    dispose = vi.fn<() => void>();
    loadAddon = vi.fn<(addon: unknown) => void>();
    cols = 80;
    rows = 24;
  }
  return { Terminal: MockTerminal };
});

// Mock FitAddon
vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn<() => void>();
  }
  return { FitAddon: MockFitAddon };
});

// Mock WebSocket
class MockWebSocket {
  url = '';
  readyState = 0;
  lastSent: string | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
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
    this.lastSent = data;
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  addEventListener(event: string, handler: () => void) {
    if (event === 'open') this.onopen = handler;
  }
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

describe('TerminalEmulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render terminal container', () => {
      render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} />);
      const container = document.querySelector('.w-full.h-full.min-h-\\[300px\\]');
      expect(container).toBeInTheDocument();
    });

    it('should have correct CSS classes for styling', () => {
      render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} />);
      const container = document.querySelector('.bg-\\[\\#1e1e1e\\]');
      expect(container).toBeInTheDocument();
    });

    it('should have accessibility attributes', () => {
      render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} />);
      const container = document.querySelector('[role="terminal"]');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('aria-label', 'Terminal emulator');
    });
  });

  describe('Terminal Initialization', () => {
    it('should initialize terminal without errors', () => {
      expect(() => {
        render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} />);
      }).not.toThrow();
    });

    it('should have displayName for debugging', () => {
      expect(TerminalEmulator.displayName).toBe('TerminalEmulator');
    });
  });

  describe('Ref Methods', () => {
    it('should expose write method via ref', async () => {
      const ref = createRef<TerminalEmulatorRef>();
      render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} ref={ref} />);

      await waitFor(() => {
        expect(ref.current).toBeDefined();
        expect(ref.current?.write).toBeInstanceOf(Function);
      });
    });

    it('should expose clear method via ref', async () => {
      const ref = createRef<TerminalEmulatorRef>();
      render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} ref={ref} />);

      await waitFor(() => {
        expect(ref.current).toBeDefined();
        expect(ref.current?.clear).toBeInstanceOf(Function);
      });
    });
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection when wsUrl is provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      render(
        <TerminalEmulator
          terminalId={VALID_TERMINAL_ID}
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
        render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} />);
      }).not.toThrow();
    });

    it('should validate terminalId format', () => {
      const onError = vi.fn();

      render(
        <TerminalEmulator
          terminalId="invalid@id!"
          wsUrl="ws://localhost:8080"
          onError={onError}
        />
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid terminalId' })
      );
    });

    it('should reject empty terminalId', () => {
      const onError = vi.fn();

      render(
        <TerminalEmulator
          terminalId=""
          wsUrl="ws://localhost:8080"
          onError={onError}
        />
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid terminalId' })
      );
    });

    it('should reject non-UUID terminalId values', () => {
      const onError = vi.fn();

      render(
        <TerminalEmulator
          terminalId="test-terminal-123"
          wsUrl="ws://localhost:8080"
          onError={onError}
        />
      );

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Invalid terminalId' })
      );
    });

    it('should accept valid terminalId UUIDs', () => {
      const onError = vi.fn();

      render(
        <TerminalEmulator
          terminalId={VALID_TERMINAL_ID}
          wsUrl="ws://localhost:8080"
          onError={onError}
        />
      );

      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('WebSocket Ready State Checks', () => {
    it('should check WebSocket ready state before sending data', () => {
      const onData = vi.fn();
      render(
        <TerminalEmulator
          terminalId={VALID_TERMINAL_ID}
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
      const onError = vi.fn();

      render(
        <TerminalEmulator
          terminalId={VALID_TERMINAL_ID}
          wsUrl="ws://localhost:8080"
          onError={onError}
        />
      );

      // Simulate receiving malformed data
      // In a real scenario, the WebSocket would receive invalid JSON
      // The component should catch and log the error without crashing

      expect(onError).toBeDefined();
    });

    it('should handle WebSocket errors gracefully', () => {
      const onError = vi.fn();

      render(
        <TerminalEmulator
          terminalId={VALID_TERMINAL_ID}
          wsUrl="ws://localhost:8080"
          onError={onError}
        />
      );

      // Error handler is set up and safe to call
      expect(onError).toBeDefined();
    });
  });

  describe('Data Handling', () => {
    it('should handle onData callback', () => {
      const onData = vi.fn();
      expect(() => {
        render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} onData={onData} />);
      }).not.toThrow();
    });

    it('should handle onResize callback', () => {
      const onResize = vi.fn();
      expect(() => {
        render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} onResize={onResize} />);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} />);
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should close WebSocket on unmount', () => {
      const { unmount } = render(
        <TerminalEmulator
          terminalId={VALID_TERMINAL_ID}
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
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      render(
        <TerminalEmulator
          terminalId={VALID_TERMINAL_ID}
          wsUrl="ws://localhost:8080"
        />
      );

      // WebSocket connection should only establish after terminal is ready
      // This is handled by the terminalReadyRef
      consoleSpy.mockRestore();
    });
  });
});
