import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection - use queueMicrotask for immediate but async execution
    queueMicrotask(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(new Event('open'));
      }
    });
  }

  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  });

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Store the original WebSocket
const originalWebSocket = global.WebSocket;

describe('wsStore', () => {
  let useWsStore: typeof import('../wsStore').useWsStore;

  beforeEach(async () => {
    vi.useFakeTimers();
    // Mock WebSocket globally
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    // Reset modules to get fresh store
    vi.resetModules();
    const module = await import('../wsStore');
    useWsStore = module.useWsStore;
  });

  afterEach(() => {
    // Clean up store before restoring timers
    const state = useWsStore.getState();
    if (state._heartbeatInterval) {
      clearInterval(state._heartbeatInterval);
    }
    if (state._reconnectTimeout) {
      clearTimeout(state._reconnectTimeout);
    }

    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });

  it('should start with disconnected status', () => {
    const state = useWsStore.getState();
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.lastHeartbeat).toBeNull();
    expect(state.reconnectAttempts).toBe(0);
  });

  it('should connect to WebSocket server', async () => {
    const { connect } = useWsStore.getState();

    connect('ws://localhost:8080');

    expect(useWsStore.getState().connectionStatus).toBe('connecting');

    // Wait for microtask to complete (WebSocket connection)
    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });
  });

  it('should send messages when connected', async () => {
    const { connect, send } = useWsStore.getState();

    connect('ws://localhost:8080');

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });

    const message = {
      type: 'terminal.input',
      payload: { data: 'test' },
      timestamp: new Date().toISOString(),
      id: 'msg-1',
    };

    send(message);

    const ws = useWsStore.getState()._ws as unknown as MockWebSocket;
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify(message));
  });

  it('should dispatch messages to correct handlers', async () => {
    const { connect, subscribe } = useWsStore.getState();

    connect('ws://localhost:8080');

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });

    const handler = vi.fn();
    const unsubscribe = subscribe('terminal.output', handler);

    const ws = useWsStore.getState()._ws as unknown as MockWebSocket;
    ws.simulateMessage({
      type: 'terminal.output',
      payload: { data: 'hello' },
      timestamp: new Date().toISOString(),
      id: 'msg-1',
    });

    expect(handler).toHaveBeenCalledWith({ data: 'hello' });

    unsubscribe();
  });

  it('should reconnect on disconnect with exponential backoff', async () => {
    const { connect } = useWsStore.getState();

    connect('ws://localhost:8080');

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });

    // Simulate disconnect
    const ws = useWsStore.getState()._ws as unknown as MockWebSocket;
    ws.simulateClose();

    expect(useWsStore.getState().connectionStatus).toBe('reconnecting');
    expect(useWsStore.getState().reconnectAttempts).toBe(1);

    // Wait for reconnect attempt (1000ms * 2^0 = 1000ms)
    vi.advanceTimersByTime(1000);

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });
  });

  it('should send heartbeat every 30 seconds', async () => {
    const { connect } = useWsStore.getState();

    connect('ws://localhost:8080');

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });

    const ws = useWsStore.getState()._ws as unknown as MockWebSocket;

    // Advance 30 seconds
    vi.advanceTimersByTime(30000);

    expect(ws.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"system.heartbeat"')
    );
  });

  it('should clean up on disconnect', async () => {
    const { connect, disconnect } = useWsStore.getState();

    connect('ws://localhost:8080');

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });

    const ws = useWsStore.getState()._ws as unknown as MockWebSocket;

    disconnect();

    expect(ws.close).toHaveBeenCalled();
    expect(useWsStore.getState().connectionStatus).toBe('disconnected');
    expect(useWsStore.getState()._ws).toBeNull();
  });

  it('should not reconnect after manual disconnect', async () => {
    const { connect, disconnect } = useWsStore.getState();

    connect('ws://localhost:8080');

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });

    disconnect();

    // Wait for potential reconnect
    vi.advanceTimersByTime(5000);

    expect(useWsStore.getState().connectionStatus).toBe('disconnected');
    expect(useWsStore.getState().reconnectAttempts).toBe(0);
  });

  it('should handle multiple subscribers for same event', async () => {
    const { connect, subscribe } = useWsStore.getState();

    connect('ws://localhost:8080');

    await vi.waitFor(() => {
      expect(useWsStore.getState().connectionStatus).toBe('connected');
    });

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    subscribe('workflow.updated', handler1);
    subscribe('workflow.updated', handler2);

    const ws = useWsStore.getState()._ws as unknown as MockWebSocket;
    ws.simulateMessage({
      type: 'workflow.updated',
      payload: { id: 'wf-1' },
      timestamp: new Date().toISOString(),
      id: 'msg-1',
    });

    expect(handler1).toHaveBeenCalledWith({ id: 'wf-1' });
    expect(handler2).toHaveBeenCalledWith({ id: 'wf-1' });
  });
});
