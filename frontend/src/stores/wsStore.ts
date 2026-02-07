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
  | 'system.error'
  | 'terminal.prompt_detected'
  | 'terminal.prompt_decision';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type MessageHandler = (payload: unknown) => void;

interface WorkflowScopedConnection {
  ws: WebSocket | null;
  status: ConnectionStatus;
  reconnectAttempts: number;
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  manualDisconnect: boolean;
  url: string;
  refCount: number;
  lastHeartbeat: Date | null;
}

interface WsState {
  // State
  connectionStatus: ConnectionStatus;
  workflowConnectionStatus: Record<string, ConnectionStatus>;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  currentWorkflowId: string | null;

  // Internal
  _ws: WebSocket | null;
  _handlers: Map<string, Set<MessageHandler>>;
  _workflowHandlers: Map<string, Map<string, Set<MessageHandler>>>;
  _workflowConnections: Map<string, WorkflowScopedConnection>;
  _heartbeatInterval: ReturnType<typeof setInterval> | null;
  _reconnectTimeout: ReturnType<typeof setTimeout> | null;
  _url: string | null;
  _manualDisconnect: boolean;

  // Actions
  connect: (url: string) => void;
  connectToWorkflow: (workflowId: string) => void;
  disconnectWorkflow: (workflowId: string) => void;
  disconnect: () => void;
  send: (message: WsMessage) => void;
  subscribe: (eventType: string, handler: MessageHandler) => () => void;
  subscribeToWorkflow: (
    workflowId: string,
    eventType: string,
    handler: MessageHandler
  ) => () => void;
  getWorkflowConnectionStatus: (workflowId: string) => ConnectionStatus;
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

const LEGACY_CONNECTION_ID = '__legacy__';

function buildWorkflowEventsUrl(workflowId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/ws/workflow/${workflowId}/events`;
}

function aggregateConnectionStatus(
  workflowConnections: Map<string, WorkflowScopedConnection>
): ConnectionStatus {
  const statuses = Array.from(workflowConnections.values()).map((connection) => connection.status);

  if (statuses.includes('connected')) {
    return 'connected';
  }
  if (statuses.includes('reconnecting')) {
    return 'reconnecting';
  }
  if (statuses.includes('connecting')) {
    return 'connecting';
  }

  return 'disconnected';
}

function aggregateLastHeartbeat(
  workflowConnections: Map<string, WorkflowScopedConnection>
): Date | null {
  let lastHeartbeat: Date | null = null;

  for (const connection of workflowConnections.values()) {
    if (!lastHeartbeat || (connection.lastHeartbeat && connection.lastHeartbeat > lastHeartbeat)) {
      lastHeartbeat = connection.lastHeartbeat;
    }
  }

  return lastHeartbeat;
}

function aggregateReconnectAttempts(
  workflowConnections: Map<string, WorkflowScopedConnection>
): number {
  let attempts = 0;

  for (const connection of workflowConnections.values()) {
    attempts = Math.max(attempts, connection.reconnectAttempts);
  }

  return attempts;
}

function toWorkflowConnectionStatusRecord(
  workflowConnections: Map<string, WorkflowScopedConnection>
): Record<string, ConnectionStatus> {
  const record: Record<string, ConnectionStatus> = {};

  for (const [workflowId, connection] of workflowConnections.entries()) {
    record[workflowId] = connection.status;
  }

  return record;
}

function createWorkflowConnection(url: string, refCount: number): WorkflowScopedConnection {
  return {
    ws: null,
    status: 'disconnected',
    reconnectAttempts: 0,
    heartbeatInterval: null,
    reconnectTimeout: null,
    manualDisconnect: false,
    url,
    refCount,
    lastHeartbeat: null,
  };
}

function clearConnectionTimers(connection: WorkflowScopedConnection): void {
  if (connection.heartbeatInterval) {
    clearInterval(connection.heartbeatInterval);
  }

  if (connection.reconnectTimeout) {
    clearTimeout(connection.reconnectTimeout);
  }
}

/**
 * WebSocket connection management store
 * Handles connection lifecycle, heartbeat, reconnection, and message routing
 */
export const useWsStore = create<WsState>((set, get) => ({
  // Initial state
  connectionStatus: 'disconnected',
  workflowConnectionStatus: {},
  lastHeartbeat: null,
  reconnectAttempts: 0,
  currentWorkflowId: null,

  // Internal state
  _ws: null,
  _handlers: new Map(),
  _workflowHandlers: new Map(),
  _workflowConnections: new Map(),
  _heartbeatInterval: null,
  _reconnectTimeout: null,
  _url: null,
  _manualDisconnect: false,

  getWorkflowConnectionStatus: (workflowId: string) => {
    return get()._workflowConnections.get(workflowId)?.status ?? 'disconnected';
  },

  subscribeToWorkflow: (workflowId: string, eventType: string, handler: MessageHandler) => {
    const workflowHandlers = get()._workflowHandlers;

    if (!workflowHandlers.has(workflowId)) {
      workflowHandlers.set(workflowId, new Map());
    }

    const eventHandlers = workflowHandlers.get(workflowId)!;
    if (!eventHandlers.has(eventType)) {
      eventHandlers.set(eventType, new Set());
    }

    eventHandlers.get(eventType)!.add(handler);

    return () => {
      const currentWorkflowHandlers = get()._workflowHandlers.get(workflowId);
      if (!currentWorkflowHandlers) {
        return;
      }

      const currentHandlers = currentWorkflowHandlers.get(eventType);
      if (!currentHandlers) {
        return;
      }

      currentHandlers.delete(handler);

      if (currentHandlers.size === 0) {
        currentWorkflowHandlers.delete(eventType);
      }

      if (currentWorkflowHandlers.size === 0) {
        get()._workflowHandlers.delete(workflowId);
      }
    };
  },

  disconnectWorkflow: (workflowId: string) => {
    const state = get();
    const connection = state._workflowConnections.get(workflowId);

    if (!connection) {
      return;
    }

    const nextConnections = new Map(state._workflowConnections);

    if (connection.refCount > 1) {
      nextConnections.set(workflowId, {
        ...connection,
        refCount: connection.refCount - 1,
      });
    } else {
      clearConnectionTimers(connection);

      if (connection.ws && connection.ws.readyState < WebSocket.CLOSING) {
        connection.ws.close();
      }

      nextConnections.delete(workflowId);

      const nextWorkflowHandlers = new Map(state._workflowHandlers);
      nextWorkflowHandlers.delete(workflowId);
      set({ _workflowHandlers: nextWorkflowHandlers });
    }

    const currentWorkflowId =
      state.currentWorkflowId && nextConnections.has(state.currentWorkflowId)
        ? state.currentWorkflowId
        : nextConnections.keys().next().value ?? null;
    const activeConnection = currentWorkflowId
      ? nextConnections.get(currentWorkflowId) ?? null
      : null;

    set({
      _workflowConnections: nextConnections,
      currentWorkflowId,
      _ws: activeConnection?.ws ?? null,
      _heartbeatInterval: activeConnection?.heartbeatInterval ?? null,
      _reconnectTimeout: activeConnection?.reconnectTimeout ?? null,
      _url: activeConnection?.url ?? null,
      _manualDisconnect: activeConnection?.manualDisconnect ?? false,
      workflowConnectionStatus: toWorkflowConnectionStatusRecord(nextConnections),
      connectionStatus: aggregateConnectionStatus(nextConnections),
      lastHeartbeat: aggregateLastHeartbeat(nextConnections),
      reconnectAttempts: aggregateReconnectAttempts(nextConnections),
    });
  },

  connectToWorkflow: (workflowId: string) => {
    const openConnection = (targetWorkflowId: string) => {
      const currentState = get();
      const currentConnection = currentState._workflowConnections.get(targetWorkflowId);

      if (!currentConnection) {
        return;
      }

      if (
        currentConnection.ws &&
        (currentConnection.ws.readyState === WebSocket.CONNECTING ||
          currentConnection.ws.readyState === WebSocket.OPEN)
      ) {
        return;
      }

      clearConnectionTimers(currentConnection);

      const ws = new WebSocket(currentConnection.url);
      const connectingConnections = new Map(currentState._workflowConnections);

      connectingConnections.set(targetWorkflowId, {
        ...currentConnection,
        ws,
        status: currentConnection.reconnectAttempts > 0 ? 'reconnecting' : 'connecting',
        manualDisconnect: false,
        heartbeatInterval: null,
        reconnectTimeout: null,
      });

      const connectingConnection = connectingConnections.get(targetWorkflowId)!;
      set({
        _workflowConnections: connectingConnections,
        currentWorkflowId: targetWorkflowId,
        _ws: connectingConnection.ws,
        _heartbeatInterval: connectingConnection.heartbeatInterval,
        _reconnectTimeout: connectingConnection.reconnectTimeout,
        _url: connectingConnection.url,
        _manualDisconnect: connectingConnection.manualDisconnect,
        workflowConnectionStatus: toWorkflowConnectionStatusRecord(connectingConnections),
        connectionStatus: aggregateConnectionStatus(connectingConnections),
        lastHeartbeat: aggregateLastHeartbeat(connectingConnections),
        reconnectAttempts: aggregateReconnectAttempts(connectingConnections),
      });

      const isStale = () => get()._workflowConnections.get(targetWorkflowId)?.ws !== ws;

      ws.onopen = () => {
        if (isStale()) return;

        const heartbeatInterval = setInterval(() => {
          const latest = get()._workflowConnections.get(targetWorkflowId);
          if (latest?.ws?.readyState === WebSocket.OPEN) {
            const heartbeatMessage: WsMessage = {
              type: 'system.heartbeat',
              payload: {},
              timestamp: new Date().toISOString(),
              id: generateMessageId(),
            };

            latest.ws.send(JSON.stringify(heartbeatMessage));

            const heartbeatConnections = new Map(get()._workflowConnections);
            const active = heartbeatConnections.get(targetWorkflowId);
            if (!active || active.ws !== latest.ws) {
              return;
            }

            heartbeatConnections.set(targetWorkflowId, {
              ...active,
              lastHeartbeat: new Date(),
            });

            const activeConnection = heartbeatConnections.get(targetWorkflowId)!;
            set({
              _workflowConnections: heartbeatConnections,
              _ws: activeConnection.ws,
              _heartbeatInterval: activeConnection.heartbeatInterval,
              _reconnectTimeout: activeConnection.reconnectTimeout,
              _url: activeConnection.url,
              _manualDisconnect: activeConnection.manualDisconnect,
              workflowConnectionStatus: toWorkflowConnectionStatusRecord(heartbeatConnections),
              connectionStatus: aggregateConnectionStatus(heartbeatConnections),
              lastHeartbeat: aggregateLastHeartbeat(heartbeatConnections),
              reconnectAttempts: aggregateReconnectAttempts(heartbeatConnections),
            });
          }
        }, HEARTBEAT_INTERVAL);

        const connectedConnections = new Map(get()._workflowConnections);
        const active = connectedConnections.get(targetWorkflowId);
        if (!active || active.ws !== ws) {
          clearInterval(heartbeatInterval);
          return;
        }

        connectedConnections.set(targetWorkflowId, {
          ...active,
          status: 'connected',
          reconnectAttempts: 0,
          heartbeatInterval,
          reconnectTimeout: null,
        });

        const activeConnection = connectedConnections.get(targetWorkflowId)!;
        set({
          _workflowConnections: connectedConnections,
          currentWorkflowId: targetWorkflowId,
          _ws: activeConnection.ws,
          _heartbeatInterval: activeConnection.heartbeatInterval,
          _reconnectTimeout: activeConnection.reconnectTimeout,
          _url: activeConnection.url,
          _manualDisconnect: activeConnection.manualDisconnect,
          workflowConnectionStatus: toWorkflowConnectionStatusRecord(connectedConnections),
          connectionStatus: aggregateConnectionStatus(connectedConnections),
          lastHeartbeat: aggregateLastHeartbeat(connectedConnections),
          reconnectAttempts: aggregateReconnectAttempts(connectedConnections),
        });
      };

      ws.onmessage = (event: MessageEvent) => {
        if (isStale()) return;

        try {
          const message = JSON.parse(event.data as string) as WsMessage;
          const currentStateForMessage = get();
          const globalHandlers = currentStateForMessage._handlers.get(message.type);
          const scopedHandlers = currentStateForMessage._workflowHandlers
            .get(targetWorkflowId)
            ?.get(message.type);

          if (globalHandlers) {
            globalHandlers.forEach((handler) => {
              try {
                handler(message.payload);
              } catch (error) {
                console.error('Error in message handler:', error);
              }
            });
          }

          if (scopedHandlers) {
            scopedHandlers.forEach((handler) => {
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

        const currentStateForClose = get();
        const connection = currentStateForClose._workflowConnections.get(targetWorkflowId);

        if (!connection) {
          return;
        }

        if (connection.heartbeatInterval) {
          clearInterval(connection.heartbeatInterval);
        }

        if (connection.manualDisconnect || connection.refCount <= 0) {
          const closedConnections = new Map(currentStateForClose._workflowConnections);
          const active = closedConnections.get(targetWorkflowId);

          if (!active || active.ws !== ws) {
            return;
          }

          closedConnections.set(targetWorkflowId, {
            ...active,
            ws: null,
            status: 'disconnected',
            heartbeatInterval: null,
            reconnectTimeout: null,
          });

          const activeConnection = closedConnections.get(targetWorkflowId)!;
          set({
            _workflowConnections: closedConnections,
            _ws: activeConnection.ws,
            _heartbeatInterval: activeConnection.heartbeatInterval,
            _reconnectTimeout: activeConnection.reconnectTimeout,
            _url: activeConnection.url,
            _manualDisconnect: activeConnection.manualDisconnect,
            workflowConnectionStatus: toWorkflowConnectionStatusRecord(closedConnections),
            connectionStatus: aggregateConnectionStatus(closedConnections),
            lastHeartbeat: aggregateLastHeartbeat(closedConnections),
            reconnectAttempts: aggregateReconnectAttempts(closedConnections),
          });
          return;
        }

        const attempts = connection.reconnectAttempts + 1;

        if (attempts <= MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, attempts - 1);
          const reconnectTimeout = setTimeout(() => {
            const latest = get()._workflowConnections.get(targetWorkflowId);
            if (!latest || latest.manualDisconnect || latest.refCount <= 0) {
              return;
            }
            openConnection(targetWorkflowId);
          }, delay);

          const reconnectingConnections = new Map(currentStateForClose._workflowConnections);
          const active = reconnectingConnections.get(targetWorkflowId);

          if (!active || active.ws !== ws) {
            clearTimeout(reconnectTimeout);
            return;
          }

          reconnectingConnections.set(targetWorkflowId, {
            ...active,
            ws: null,
            status: 'reconnecting',
            reconnectAttempts: attempts,
            heartbeatInterval: null,
            reconnectTimeout,
          });

          const activeConnection = reconnectingConnections.get(targetWorkflowId)!;
          set({
            _workflowConnections: reconnectingConnections,
            _ws: activeConnection.ws,
            _heartbeatInterval: activeConnection.heartbeatInterval,
            _reconnectTimeout: activeConnection.reconnectTimeout,
            _url: activeConnection.url,
            _manualDisconnect: activeConnection.manualDisconnect,
            workflowConnectionStatus: toWorkflowConnectionStatusRecord(reconnectingConnections),
            connectionStatus: aggregateConnectionStatus(reconnectingConnections),
            lastHeartbeat: aggregateLastHeartbeat(reconnectingConnections),
            reconnectAttempts: aggregateReconnectAttempts(reconnectingConnections),
          });
        } else {
          const disconnectedConnections = new Map(currentStateForClose._workflowConnections);
          const active = disconnectedConnections.get(targetWorkflowId);
          if (!active || active.ws !== ws) {
            return;
          }

          disconnectedConnections.set(targetWorkflowId, {
            ...active,
            ws: null,
            status: 'disconnected',
            heartbeatInterval: null,
            reconnectTimeout: null,
          });

          const activeConnection = disconnectedConnections.get(targetWorkflowId)!;
          set({
            _workflowConnections: disconnectedConnections,
            _ws: activeConnection.ws,
            _heartbeatInterval: activeConnection.heartbeatInterval,
            _reconnectTimeout: activeConnection.reconnectTimeout,
            _url: activeConnection.url,
            _manualDisconnect: activeConnection.manualDisconnect,
            workflowConnectionStatus: toWorkflowConnectionStatusRecord(disconnectedConnections),
            connectionStatus: aggregateConnectionStatus(disconnectedConnections),
            lastHeartbeat: aggregateLastHeartbeat(disconnectedConnections),
            reconnectAttempts: aggregateReconnectAttempts(disconnectedConnections),
          });
        }
      };

      ws.onerror = () => {
        if (isStale()) return;
        console.error('WebSocket error occurred');
      };
    };

    const state = get();
    const existingConnection = state._workflowConnections.get(workflowId);
    const nextConnections = new Map(state._workflowConnections);

    if (existingConnection) {
      nextConnections.set(workflowId, {
        ...existingConnection,
        refCount: existingConnection.refCount + 1,
        manualDisconnect: false,
      });
    } else {
      nextConnections.set(workflowId, {
        ...createWorkflowConnection(buildWorkflowEventsUrl(workflowId), 1),
      });
    }

    const currentConnection = nextConnections.get(workflowId)!;
    set({
      _workflowConnections: nextConnections,
      currentWorkflowId: workflowId,
      _ws: currentConnection.ws,
      _heartbeatInterval: currentConnection.heartbeatInterval,
      _reconnectTimeout: currentConnection.reconnectTimeout,
      _url: currentConnection.url,
      _manualDisconnect: currentConnection.manualDisconnect,
      workflowConnectionStatus: toWorkflowConnectionStatusRecord(nextConnections),
      connectionStatus: aggregateConnectionStatus(nextConnections),
      lastHeartbeat: aggregateLastHeartbeat(nextConnections),
      reconnectAttempts: aggregateReconnectAttempts(nextConnections),
    });

    openConnection(workflowId);
  },

  connect: (url: string) => {
    const state = get();

    const legacyConnection = state._workflowConnections.get(LEGACY_CONNECTION_ID);
    if (legacyConnection) {
      clearConnectionTimers(legacyConnection);
      if (legacyConnection.ws && legacyConnection.ws.readyState < WebSocket.CLOSING) {
        legacyConnection.ws.close();
      }
    }

    const nextConnections = new Map(state._workflowConnections);
    nextConnections.set(LEGACY_CONNECTION_ID, createWorkflowConnection(url, 0));

    const activeConnection = nextConnections.get(LEGACY_CONNECTION_ID)!;
    set({
      _workflowConnections: nextConnections,
      currentWorkflowId: LEGACY_CONNECTION_ID,
      _ws: activeConnection.ws,
      _heartbeatInterval: activeConnection.heartbeatInterval,
      _reconnectTimeout: activeConnection.reconnectTimeout,
      _url: activeConnection.url,
      _manualDisconnect: activeConnection.manualDisconnect,
      workflowConnectionStatus: toWorkflowConnectionStatusRecord(nextConnections),
      connectionStatus: aggregateConnectionStatus(nextConnections),
      lastHeartbeat: aggregateLastHeartbeat(nextConnections),
      reconnectAttempts: aggregateReconnectAttempts(nextConnections),
    });

    get().connectToWorkflow(LEGACY_CONNECTION_ID);
  },

  disconnect: () => {
    const state = get();

    for (const connection of state._workflowConnections.values()) {
      clearConnectionTimers(connection);

      if (connection.ws && connection.ws.readyState < WebSocket.CLOSING) {
        connection.ws.close();
      }
    }

    set({
      connectionStatus: 'disconnected',
      workflowConnectionStatus: {},
      lastHeartbeat: null,
      currentWorkflowId: null,
      _ws: null,
      _workflowConnections: new Map(),
      _heartbeatInterval: null,
      _reconnectTimeout: null,
      _url: null,
      _manualDisconnect: true,
      reconnectAttempts: 0,
    });
  },

  send: (message: WsMessage) => {
    const state = get();
    const activeWs = state._ws;

    if (activeWs?.readyState === WebSocket.OPEN) {
      activeWs.send(JSON.stringify(message));
      return;
    }

    const fallbackConnection = Array.from(state._workflowConnections.values()).find(
      (connection) => connection.ws?.readyState === WebSocket.OPEN
    );

    if (fallbackConnection?.ws?.readyState === WebSocket.OPEN) {
      fallbackConnection.ws.send(JSON.stringify(message));
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

export interface TerminalPromptDetectedPayload {
  workflowId: string;
  terminalId: string;
  promptKind: string;
  promptText: string;
  confidence: number;
  hasDangerousKeywords: boolean;
  options: string[];
  selectedIndex: number | null;
}

export interface TerminalPromptDecisionPayload {
  workflowId: string;
  terminalId: string;
  decision: string;
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
    onTerminalPromptDetected?: (payload: TerminalPromptDetectedPayload) => void;
    onTerminalPromptDecision?: (payload: TerminalPromptDecisionPayload) => void;
    onGitCommitDetected?: (payload: GitCommitPayload) => void;
    onSystemError?: (payload: SystemErrorPayload) => void;
  }
) {
  const connectToWorkflow = useWsStore((s) => s.connectToWorkflow);
  const disconnectWorkflow = useWsStore((s) => s.disconnectWorkflow);
  const subscribeToWorkflow = useWsStore((s) => s.subscribeToWorkflow);
  const connectionStatus = useWsStore((s) =>
    workflowId ? s.workflowConnectionStatus[workflowId] ?? 'disconnected' : s.connectionStatus
  );

  // Connect to workflow on mount, disconnect on unmount
  React.useEffect(() => {
    if (workflowId) {
      connectToWorkflow(workflowId);
    }

    return () => {
      if (workflowId) {
        disconnectWorkflow(workflowId);
      }
    };
  }, [workflowId, connectToWorkflow, disconnectWorkflow]);

  // Subscribe to events
  React.useEffect(() => {
    if (!workflowId) return;

    const unsubscribers: (() => void)[] = [];

    if (handlers?.onWorkflowStatusChanged) {
      unsubscribers.push(
        subscribeToWorkflow(
          workflowId,
          'workflow.status_changed',
          handlers.onWorkflowStatusChanged as MessageHandler
        )
      );
    }

    if (handlers?.onTerminalStatusChanged) {
      unsubscribers.push(
        subscribeToWorkflow(
          workflowId,
          'terminal.status_changed',
          handlers.onTerminalStatusChanged as MessageHandler
        )
      );
    }

    if (handlers?.onTaskStatusChanged) {
      unsubscribers.push(
        subscribeToWorkflow(
          workflowId,
          'task.status_changed',
          handlers.onTaskStatusChanged as MessageHandler
        )
      );
    }

    if (handlers?.onTerminalCompleted) {
      unsubscribers.push(
        subscribeToWorkflow(
          workflowId,
          'terminal.completed',
          handlers.onTerminalCompleted as MessageHandler
        )
      );
    }

    if (handlers?.onTerminalPromptDetected) {
      unsubscribers.push(
        subscribeToWorkflow(
          workflowId,
          'terminal.prompt_detected',
          handlers.onTerminalPromptDetected as MessageHandler
        )
      );
    }

    if (handlers?.onTerminalPromptDecision) {
      unsubscribers.push(
        subscribeToWorkflow(
          workflowId,
          'terminal.prompt_decision',
          handlers.onTerminalPromptDecision as MessageHandler
        )
      );
    }

    if (handlers?.onGitCommitDetected) {
      unsubscribers.push(
        subscribeToWorkflow(
          workflowId,
          'git.commit_detected',
          handlers.onGitCommitDetected as MessageHandler
        )
      );
    }

    if (handlers?.onSystemError) {
      unsubscribers.push(
        subscribeToWorkflow(workflowId, 'system.error', handlers.onSystemError as MessageHandler)
      );
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [workflowId, handlers, subscribeToWorkflow]);

  return { connectionStatus };
}
