import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLogStream } from './useLogStream';

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close = vi.fn(() => {
    this.onclose?.({ code: 1000 } as CloseEvent);
  });

  emitOpen() {
    this.onopen?.(new Event('open'));
  }

  emitJsonPatch(type: 'STDOUT' | 'STDERR', content: string) {
    this.onmessage?.({
      data: JSON.stringify({
        JsonPatch: [{ value: { type, content } }],
      }),
    } as MessageEvent);
  }
}

const originalWebSocket = globalThis.WebSocket;

describe('useLogStream', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.clearAllMocks();
  });

  it('keeps only the most recent 5000 log entries', async () => {
    const { result } = renderHook(() => useLogStream('process-1'));
    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    act(() => {
      ws.emitOpen();
      for (let i = 0; i < 5200; i += 1) {
        ws.emitJsonPatch('STDOUT', `line-${i}`);
      }
    });

    await waitFor(() => {
      expect(result.current.logs).toHaveLength(5000);
    });

    expect(result.current.logs[0]).toMatchObject({
      type: 'STDOUT',
      content: 'line-200',
    });
    expect(result.current.logs[4999]).toMatchObject({
      type: 'STDOUT',
      content: 'line-5199',
    });
  });
});
