/**
 * WebSocket message types for terminal communication
 */
export type WsMessage =
    | WsOutputMessage
    | WsErrorMessage
    | WsInputMessage
    | WsResizeMessage;

/**
 * Output message from server to client (terminal response)
 */
export interface WsOutputMessage {
    readonly type: 'output';
    readonly data: string;
}

/**
 * Error message from server to client
 */
export interface WsErrorMessage {
    readonly type: 'error';
    readonly message: string;
}

/**
 * Input message from client to server (keystrokes)
 */
export interface WsInputMessage {
    readonly type: 'input';
    readonly data: string;
}

/**
 * Resize message from client to server
 */
export interface WsResizeMessage {
    readonly type: 'resize';
    readonly cols: number;
    readonly rows: number;
}

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
