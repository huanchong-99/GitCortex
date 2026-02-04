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
  | 'workflow.status_changed'
  | 'terminal.status_changed'
  | 'task.status_changed'
  | 'terminal.completed'
  | 'git.commit_detected'
  | 'orchestrator.awakened'
  | 'orchestrator.decision'
  | 'system.heartbeat'
  | 'system.lagged'
  | 'system.error';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type MessageHandler = (payload: unknown) => void;

interface WsState {
  // State
  connectionStatus: ConnectionStatus;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  currentWorkflowId: string | null;

  // Internal
  _ws: WebSocket | null;
  _handlers: Map<string, Set<MessageHandler>>;
  _heartbeatInterval: ReturnType<typeof setInterval> | null;
  _reconnectTimeout: ReturnType<typeof setTimeout> | null;
  _url: string | null;
  _manualDisconnect: boolean;

  // Actions
  connect: (url: string) => void;
  connectToWorkflow: (workflowId: string) => void;
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
  currentWorkflowId: null,

  // Internal state
  _ws: null,
  _handlers: new Map(),
  _heartbeatInterval: null,
  _reconnectTimeout: null,
  _url: null,
  _manualDisconnect: false,

  connectToWorkflow: (workflowId: string) => {
    const state = get();

    // If already connected to this workflow, do nothing
    if (state.currentWorkflowId === workflowId && state.connectionStatus === 'connected') {
      return;
    }

    // Build WebSocket URL for workflow events
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/api/ws/workflow/${workflowId}/events`;

    set({ currentWorkflowId: workflowId });
    state.connect(url);
  },

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

    set({ _manualDisconnect: true, currentWorkflowId: null });

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

/**
 * Payload types for workflow events
 */
export interface WorkflowStatusPayload {
  workflowId: string;
  status: string;
}

export interface TerminalStatusPayload {
  workflowId: string;
  terminalId: string;
  status: string;
}

export interface TaskStatusPayload {
  workflowId: string;
  taskId: string;
  status: string;
}

export interface GitCommitPayload {
  workflowId: string;
  commitHash: string;
  branch: string;
  message: string;
}

export interface TerminalCompletedPayload {
  workflowId: string;
  taskId: string;
  terminalId: string;
  status: 'completed' | 'failed' | 'cancelled';
  commitHash?: string;
  commitMessage?: string;
}

export interface SystemLaggedPayload {
  skipped: number;
}

export interface SystemErrorPayload {
  workflowId?: string;
  error?: string;
  message?: string;
}

/**
 * Hook to connect to workflow events and subscribe to specific event types
 * Automatically connects on mount and disconnects on unmount
 */
export function useWorkflowEvents(
  workflowId: string | null | undefined,
  handlers?: {
    onWorkflowStatusChanged?: (payload: WorkflowStatusPayload) => void;
    onTerminalStatusChanged?: (payload: TerminalStatusPayload) => void;
    onTaskStatusChanged?: (payload: TaskStatusPayload) => void;
    onTerminalCompleted?: (payload: TerminalCompletedPayload) => void;
    onGitCommitDetected?: (payload: GitCommitPayload) => void;
    onSystemError?: (payload: SystemErrorPayload) => void;
  }
) {
  const connectToWorkflow = useWsStore((s) => s.connectToWorkflow);
  const disconnect = useWsStore((s) => s.disconnect);
  const subscribe = useWsStore((s) => s.subscribe);
  const connectionStatus = useWsStore((s) => s.connectionStatus);

  // Connect to workflow on mount, disconnect on unmount
  React.useEffect(() => {
    if (workflowId) {
      connectToWorkflow(workflowId);
    }

    return () => {
      disconnect();
    };
  }, [workflowId, connectToWorkflow, disconnect]);

  // Subscribe to events
  React.useEffect(() => {
    if (!workflowId) return;

    const unsubscribers: (() => void)[] = [];

    if (handlers?.onWorkflowStatusChanged) {
      unsubscribers.push(
        subscribe('workflow.status_changed', handlers.onWorkflowStatusChanged as MessageHandler)
      );
    }

    if (handlers?.onTerminalStatusChanged) {
      unsubscribers.push(
        subscribe('terminal.status_changed', handlers.onTerminalStatusChanged as MessageHandler)
      );
    }

    if (handlers?.onTaskStatusChanged) {
      unsubscribers.push(
        subscribe('task.status_changed', handlers.onTaskStatusChanged as MessageHandler)
      );
    }

    if (handlers?.onTerminalCompleted) {
      unsubscribers.push(
        subscribe('terminal.completed', handlers.onTerminalCompleted as MessageHandler)
      );
    }

    if (handlers?.onGitCommitDetected) {
      unsubscribers.push(
        subscribe('git.commit_detected', handlers.onGitCommitDetected as MessageHandler)
      );
    }

    if (handlers?.onSystemError) {
      unsubscribers.push(
        subscribe('system.error', handlers.onSystemError as MessageHandler)
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [workflowId, handlers, subscribe]);

  return { connectionStatus };
}
