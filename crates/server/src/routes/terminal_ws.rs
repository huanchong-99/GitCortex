//! Terminal WebSocket routes

use axum::{
    extract::{Path, State, WebSocketUpgrade, ws::{Message, WebSocket}},
    response::IntoResponse,
    routing::get,
    Router,
};
use db::models::Terminal;
use deployment::Deployment;
use futures_util::{SinkExt, StreamExt};
use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{timeout, Instant};
use ts_rs::TS;
use crate::DeploymentImpl;
use crate::error::ApiError;

// ============================================================================
// Constants
// ============================================================================

/// Connection timeout for initial WebSocket setup (30 seconds)
const WS_CONNECT_TIMEOUT_SECS: u64 = 30;

/// Idle timeout - close connection if no activity (5 minutes)
const WS_IDLE_TIMEOUT_SECS: u64 = 300;

/// Heartbeat interval for keep-alive (30 seconds)
const WS_HEARTBEAT_INTERVAL_SECS: u64 = 30;

// Compile-time sanity check for timeout ordering.
const _: () = {
    assert!(WS_HEARTBEAT_INTERVAL_SECS < WS_IDLE_TIMEOUT_SECS);
};

// ============================================================================
// UUID Validation
// ============================================================================

/// UUID v4 regex pattern (case-insensitive)
/// Matches format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
/// where x is a hexadecimal digit (0-9, a-f, case-insensitive)
static UUID_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap()
});

/// Validates that terminal_id is a properly formatted UUID
///
/// # Arguments
/// * `terminal_id` - The terminal ID string to validate
///
/// # Returns
/// * `Ok(())` if the terminal_id is a valid UUID format
/// * `Err(anyhow::Error)` if the terminal_id is invalid
pub fn validate_terminal_id(terminal_id: &str) -> anyhow::Result<()> {
    if UUID_REGEX.is_match(terminal_id) {
        Ok(())
    } else {
        Err(anyhow::anyhow!(
            "Invalid terminal_id format: expected UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"
        ))
    }
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

/// WebSocket message types
#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    /// Input from client (user keystrokes)
    Input { data: String },
    /// Output to client (terminal response)
    Output { data: String },
    /// Terminal resize request
    Resize { cols: u16, rows: u16 },
    /// Error message
    Error { message: String },
}

// ============================================================================
// Route Definition
// ============================================================================

/// Create terminal WebSocket routes
pub fn terminal_ws_routes() -> Router<DeploymentImpl> {
    Router::new().route("/:terminal_id", get(terminal_ws_handler))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// WebSocket handler for terminal connection
async fn terminal_ws_handler(
    ws: WebSocketUpgrade,
    Path(terminal_id): Path<String>,
    State(deployment): State<DeploymentImpl>,
) -> impl IntoResponse {
    // Validate terminal_id format before proceeding
    if let Err(e) = validate_terminal_id(&terminal_id) {
        tracing::warn!("Invalid terminal_id format: {} - {}", terminal_id, e);
        return ApiError::BadRequest(format!("Invalid terminal_id format: {e}")).into_response();
    }

    ws.on_upgrade(move |socket| handle_terminal_socket(socket, terminal_id, deployment))
}

/// Handle terminal WebSocket connection
async fn handle_terminal_socket(
    socket: WebSocket,
    terminal_id: String,
    deployment: DeploymentImpl,
) {
    tracing::info!("Terminal WebSocket connected: {}", terminal_id);

    // Split the WebSocket into sender and receiver
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Create channel for PTY input (client -> PTY)
    let (_pty_input_tx, mut pty_input_rx) = mpsc::channel::<Vec<u8>>(100);

    // Clone for tasks
    let terminal_id_clone = terminal_id.clone();
    let terminal_id_pty = terminal_id.clone();

    // Spawn PTY writer task: receive from channel and write to PTY stdin
    let pty_writer_task = tokio::spawn(async move {
        while let Some(data) = pty_input_rx.recv().await {
            // TODO: Write to actual PTY stdin
            // For now, just log
            tracing::debug!(
                "PTY {} stdin: {} bytes",
                terminal_id_pty,
                data.len()
            );
        }
    });

    // Get terminal from database with timeout
    let terminal_result = timeout(
        Duration::from_secs(WS_CONNECT_TIMEOUT_SECS),
        Terminal::find_by_id(&deployment.db().pool, &terminal_id)
    ).await;

    let terminal = match terminal_result {
        Ok(Ok(Some(t))) => t,
        Ok(Ok(None)) => {
            let msg = WsMessage::Error {
                message: "Terminal not found".to_string(),
            };
            let _ = ws_sender
                .send(Message::Text(serde_json::to_string(&msg).unwrap().into()))
                .await;
            let _ = ws_sender.close().await;
            return;
        }
        Ok(Err(e)) => {
            tracing::error!("Database error fetching terminal: {}", e);
            let msg = WsMessage::Error {
                message: format!("Database error: {e}"),
            };
            let _ = ws_sender
                .send(Message::Text(serde_json::to_string(&msg).unwrap().into()))
                .await;
            let _ = ws_sender.close().await;
            return;
        }
        Err(_) => {
            tracing::error!("Connection timeout while fetching terminal {}", terminal_id);
            let msg = WsMessage::Error {
                message: format!("Connection timeout after {WS_CONNECT_TIMEOUT_SECS}s"),
            };
            let _ = ws_sender
                .send(Message::Text(serde_json::to_string(&msg).unwrap().into()))
                .await;
            let _ = ws_sender.close().await;
            return;
        }
    };

    tracing::debug!(
        "Terminal found: {} (task: {}, status: {})",
        terminal_id,
        terminal.workflow_task_id,
        terminal.status
    );

    // Create channel for bi-directional communication
    let (_tx, mut rx) = mpsc::channel::<String>(100);

    // Clone terminal_id for use in tasks
    let terminal_id_heartbeat = terminal_id.clone();

    // Track last activity time for idle timeout
    let last_activity = std::sync::Arc::new(tokio::sync::RwLock::new(Instant::now()));
    let last_activity_recv = last_activity.clone();
    let last_activity_heartbeat = last_activity.clone();

    // Spawn send task: receive from channel and send to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(data) = rx.recv().await {
            let msg = WsMessage::Output { data };
            match serde_json::to_string(&msg) {
                Ok(json) => {
                    if ws_sender.send(Message::Text(json.into())).await.is_err() {
                        tracing::warn!("Failed to send message to WebSocket");
                        break;
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to serialize message: {}", e);
                    break;
                }
            }
        }
    });

    // Spawn heartbeat task: check for idle timeout and send pings
    let heartbeat_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(WS_HEARTBEAT_INTERVAL_SECS));
        loop {
            interval.tick().await;

            let last = *last_activity_heartbeat.read().await;
            let idle_duration = last.elapsed();

            if idle_duration > Duration::from_secs(WS_IDLE_TIMEOUT_SECS) {
                tracing::warn!(
                    "Terminal {} idle timeout after {}s",
                    terminal_id_heartbeat,
                    idle_duration.as_secs()
                );
                break;
            }

            tracing::trace!(
                "Terminal {} heartbeat check, idle for {}s",
                terminal_id_heartbeat,
                idle_duration.as_secs()
            );
        }
    });

    // Spawn receive task: receive from WebSocket and process with timeout
    let recv_task = tokio::spawn(async move {
        loop {
            // Use timeout for each message receive
            let recv_result = timeout(
                Duration::from_secs(WS_IDLE_TIMEOUT_SECS),
                ws_receiver.next()
            ).await;

            match recv_result {
                Ok(Some(result)) => {
                    // Update last activity time
                    *last_activity_recv.write().await = Instant::now();

                    match result {
                        Ok(msg) => match msg {
                            Message::Text(text) => {
                                if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                                    match ws_msg {
                                        WsMessage::Input { data } => {
                                            // TODO: Send input to PTY
                                            // For now, just log it
                                            tracing::debug!(
                                                "Terminal {} input: {} bytes",
                                                terminal_id_clone,
                                                data.len()
                                            );
                                        }
                                        WsMessage::Resize { cols, rows } => {
                                            // TODO: Resize PTY
                                            tracing::debug!(
                                                "Terminal {} resize: {}x{}",
                                                terminal_id_clone,
                                                cols,
                                                rows
                                            );
                                        }
                                        WsMessage::Output { .. } => {
                                            tracing::warn!(
                                                "Client sent unexpected Output message"
                                            );
                                        }
                                        WsMessage::Error { .. } => {
                                            tracing::warn!("Client sent unexpected Error message");
                                        }
                                    }
                                } else {
                                    tracing::warn!(
                                        "Failed to parse WebSocket message: {}",
                                        text
                                    );
                                }
                            }
                            Message::Close(_) => {
                                tracing::info!("Client requested close");
                                break;
                            }
                            Message::Ping(data) => {
                                // Respond to ping with pong
                                // Note: Axum handles this automatically in most cases
                                tracing::trace!("Received ping: {} bytes", data.len());
                            }
                            Message::Pong(data) => {
                                tracing::trace!("Received pong: {} bytes", data.len());
                            }
                            Message::Binary(data) => {
                                tracing::warn!("Received unexpected binary data: {} bytes", data.len());
                            }
                        },
                        Err(e) => {
                            tracing::error!("WebSocket error: {}", e);
                            break;
                        }
                    }
                }
                Ok(None) => {
                    tracing::debug!("WebSocket stream ended");
                    break;
                }
                Err(_) => {
                    tracing::warn!(
                        "Terminal {} receive timeout after {}s of inactivity",
                        terminal_id_clone,
                        WS_IDLE_TIMEOUT_SECS
                    );
                    break;
                }
            }
        }
    });

    // Wait for any task to complete
    tokio::select! {
        _ = send_task => {
            tracing::debug!("Send task completed for terminal {}", terminal_id);
        }
        _ = recv_task => {
            tracing::debug!("Receive task completed for terminal {}", terminal_id);
        }
        _ = heartbeat_task => {
            tracing::debug!("Heartbeat task completed (idle timeout) for terminal {}", terminal_id);
        }
        _ = pty_writer_task => {
            tracing::debug!("PTY writer task completed for terminal {}", terminal_id);
        }
    }

    tracing::info!("Terminal WebSocket disconnected: {}", terminal_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timeout_constants() {
        // Verify timeout constants are reasonable values
        assert_eq!(WS_CONNECT_TIMEOUT_SECS, 30);
        assert_eq!(WS_IDLE_TIMEOUT_SECS, 300); // 5 minutes
        assert_eq!(WS_HEARTBEAT_INTERVAL_SECS, 30);

    }

    #[test]
    fn test_ws_message_serialization() {
        // Test Input message
        let input = WsMessage::Input {
            data: "ls -la".to_string(),
        };
        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("input"));
        assert!(json.contains("ls -la"));

        // Test Output message
        let output = WsMessage::Output {
            data: "total 0".to_string(),
        };
        let json = serde_json::to_string(&output).unwrap();
        assert!(json.contains("output"));
        assert!(json.contains("total 0"));

        // Test Resize message
        let resize = WsMessage::Resize { cols: 80, rows: 24 };
        let json = serde_json::to_string(&resize).unwrap();
        assert!(json.contains("resize"));
        assert!(json.contains("80"));
        assert!(json.contains("24"));

        // Test Error message
        let error = WsMessage::Error {
            message: "Test error".to_string(),
        };
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("error"));
        assert!(json.contains("Test error"));
    }

    #[test]
    fn test_ws_message_deserialization() {
        // Test Input message
        let json = r#"{"type":"input","data":"test"}"#;
        let msg: WsMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsMessage::Input { data } => {
                assert_eq!(data, "test");
            }
            _ => panic!("Expected Input message"),
        }

        // Test Output message
        let json = r#"{"type":"output","data":"response"}"#;
        let msg: WsMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsMessage::Output { data } => {
                assert_eq!(data, "response");
            }
            _ => panic!("Expected Output message"),
        }

        // Test Resize message
        let json = r#"{"type":"resize","cols":120,"rows":30}"#;
        let msg: WsMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsMessage::Resize { cols, rows } => {
                assert_eq!(cols, 120);
                assert_eq!(rows, 30);
            }
            _ => panic!("Expected Resize message"),
        }

        // Test Error message
        let json = r#"{"type":"error","message":"error message"}"#;
        let msg: WsMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsMessage::Error { message } => {
                assert_eq!(message, "error message");
            }
            _ => panic!("Expected Error message"),
        }
    }
}
