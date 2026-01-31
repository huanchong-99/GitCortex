import * as React from 'react';
import { create } from 'zustand';

/**
 * WebSocket message structure following design specification
 */
export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: string;
  id: string;
}

/**
 * WebSocket event types following namespace convention
 */
export type WsEventType =
  | `workflow.${string}`
  | `terminal.${string}`
  | `git.${string}`
  | `orchestrator.${string}`
  | `system.${string}`;

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type MessageHandler = (payload: unknown) => void;

interface WsState {
  // State
  connectionStatus: ConnectionStatus;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;

  // Internal
  _ws: WebSocket | null;
  _handlers: Map<string, Set<MessageHandler>>;
  _heartbeatInterval: ReturnType<typeof setInterval> | null;
  _reconnectTimeout: ReturnType<typeof setTimeout> | null;
  _url: string | null;
  _manualDisconnect: boolean;

  // Actions
  connect: (url: string) => void;
  disconnect: () => void;
  send: (message: WsMessage) => void;
  subscribe: (eventType: string, handler: MessageHandler) => () => void;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000; // 1 second

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * WebSocket connection management store
 * Handles connection lifecycle, heartbeat, reconnection, and message routing
 */
export const useWsStore = create<WsState>((set, get) => ({
  // Initial state
  connectionStatus: 'disconnected',
  lastHeartbeat: null,
  reconnectAttempts: 0,

  // Internal state
  _ws: null,
  _handlers: new Map(),
  _heartbeatInterval: null,
  _reconnectTimeout: null,
  _url: null,
  _manualDisconnect: false,

  connect: (url: string) => {
    const state = get();

    // Clean up existing connection - set _ws to null first to prevent stale callbacks
    if (state._ws) {
      set({ _ws: null });
      state._ws.close();
    }
    if (state._heartbeatInterval) {
      clearInterval(state._heartbeatInterval);
    }
    if (state._reconnectTimeout) {
      clearTimeout(state._reconnectTimeout);
    }

    set({
      connectionStatus: 'connecting',
      _url: url,
      _manualDisconnect: false,
      _heartbeatInterval: null,
      _reconnectTimeout: null,
    });

    const ws = new WebSocket(url);
    set({ _ws: ws });

    // Staleness check to prevent old socket callbacks from affecting new connections
    const isStale = () => get()._ws !== ws;

    ws.onopen = () => {
      if (isStale()) return;

      set({
        connectionStatus: 'connected',
        reconnectAttempts: 0,
        _ws: ws,
      });

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        const currentState = get();
        if (currentState._ws?.readyState === WebSocket.OPEN) {
          const heartbeatMessage: WsMessage = {
            type: 'system.heartbeat',
            payload: {},
            timestamp: new Date().toISOString(),
            id: generateMessageId(),
          };
          currentState._ws.send(JSON.stringify(heartbeatMessage));
          set({ lastHeartbeat: new Date() });
        }
      }, HEARTBEAT_INTERVAL);

      set({ _heartbeatInterval: heartbeatInterval });
    };

    ws.onmessage = (event: MessageEvent) => {
      if (isStale()) return;

      try {
        const message = JSON.parse(event.data as string) as WsMessage;
        const handlers = get()._handlers.get(message.type);

        if (handlers) {
          handlers.forEach((handler) => {
            try {
              handler(message.payload);
            } catch (error) {
              console.error('Error in message handler:', error);
            }
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      if (isStale()) return;

      const currentState = get();

      // Clean up heartbeat
      if (currentState._heartbeatInterval) {
        clearInterval(currentState._heartbeatInterval);
      }

      // Don't reconnect if manually disconnected
      if (currentState._manualDisconnect) {
        set({
          connectionStatus: 'disconnected',
          _ws: null,
          _heartbeatInterval: null,
          _reconnectTimeout: null,
        });
        return;
      }

      // Attempt reconnection
      const attempts = currentState.reconnectAttempts + 1;

      if (attempts <= MAX_RECONNECT_ATTEMPTS && currentState._url) {
        set({
          connectionStatus: 'reconnecting',
          reconnectAttempts: attempts,
          _ws: null,
          _heartbeatInterval: null,
        });

        // Exponential backoff
        const delay = BASE_RECONNECT_DELAY * Math.pow(2, attempts - 1);
        const reconnectTimeout = setTimeout(() => {
          const state = get();
          if (state._url && !state._manualDisconnect) {
            state.connect(state._url);
          }
        }, delay);

        set({ _reconnectTimeout: reconnectTimeout });
      } else {
        set({
          connectionStatus: 'disconnected',
          _ws: null,
          _heartbeatInterval: null,
          _reconnectTimeout: null,
        });
      }
    };

    ws.onerror = () => {
      if (isStale()) return;
      // Error handling is done in onclose
      console.error('WebSocket error occurred');
    };
  },

  disconnect: () => {
    const state = get();

    set({ _manualDisconnect: true });

    if (state._heartbeatInterval) {
      clearInterval(state._heartbeatInterval);
    }

    if (state._reconnectTimeout) {
      clearTimeout(state._reconnectTimeout);
    }

    if (state._ws) {
      state._ws.close();
    }

    set({
      connectionStatus: 'disconnected',
      _ws: null,
      _heartbeatInterval: null,
      _reconnectTimeout: null,
      reconnectAttempts: 0,
    });
  },

  send: (message: WsMessage) => {
    const ws = get()._ws;

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected, cannot send message');
    }
  },

  subscribe: (eventType: string, handler: MessageHandler) => {
    const handlers = get()._handlers;

    if (!handlers.has(eventType)) {
      handlers.set(eventType, new Set());
    }

    handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const currentHandlers = get()._handlers.get(eventType);
      if (currentHandlers) {
        currentHandlers.delete(handler);
        if (currentHandlers.size === 0) {
          get()._handlers.delete(eventType);
        }
      }
    };
  },
}));

/**
 * Hook to subscribe to WebSocket events
 * Automatically unsubscribes on unmount
 */
export function useWsSubscription(
  eventType: string,
  handler: MessageHandler,
  deps: React.DependencyList = []
) {
  const subscribe = useWsStore((s) => s.subscribe);

  // Use effect to manage subscription lifecycle
  React.useEffect(() => {
    return subscribe(eventType, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, handler, subscribe, ...deps]);
}
