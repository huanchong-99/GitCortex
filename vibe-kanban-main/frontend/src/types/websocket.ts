import type { WsMessage as SharedWsMessage } from 'shared/types';

/**
 * WebSocket message types for terminal communication
 */
export type WsMessage = SharedWsMessage;

/**
 * Output message from server to client (terminal response)
 */
export type WsOutputMessage = Extract<WsMessage, { type: 'output' }>;

/**
 * Error message from server to client
 */
export type WsErrorMessage = Extract<WsMessage, { type: 'error' }>;

/**
 * Input message from client to server (keystrokes)
 */
export type WsInputMessage = Extract<WsMessage, { type: 'input' }>;

/**
 * Resize message from client to server
 */
export type WsResizeMessage = Extract<WsMessage, { type: 'resize' }>;

/**
 * Type guard for WsOutputMessage
 * @param msg - Unknown message to check
 * @returns True if msg is a valid WsOutputMessage
 */
export function isWsOutputMessage(msg: unknown): msg is WsOutputMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        'type' in msg &&
        (msg as WsMessage).type === 'output' &&
        'data' in msg &&
        typeof (msg as WsOutputMessage).data === 'string'
    );
}

/**
 * Type guard for WsErrorMessage
 * @param msg - Unknown message to check
 * @returns True if msg is a valid WsErrorMessage
 */
export function isWsErrorMessage(msg: unknown): msg is WsErrorMessage {
    return (
        typeof msg === 'object' &&
        msg !== null &&
        'type' in msg &&
        (msg as WsMessage).type === 'error' &&
        'message' in msg &&
        typeof (msg as WsErrorMessage).message === 'string'
    );
}
