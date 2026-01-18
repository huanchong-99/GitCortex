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
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use crate::DeploymentImpl;

// ============================================================================
// WebSocket Message Types
// ============================================================================

/// WebSocket message types
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum WsMessage {
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

    // Get terminal from database
    let terminal = match Terminal::find_by_id(&deployment.db().pool, &terminal_id).await {
        Ok(Some(t)) => t,
        Ok(None) => {
            let msg = WsMessage::Error {
                message: "Terminal not found".to_string(),
            };
            let _ = ws_sender
                .send(Message::Text(serde_json::to_string(&msg).unwrap().into()))
                .await;
            let _ = ws_sender.close().await;
            return;
        }
        Err(e) => {
            tracing::error!("Database error fetching terminal: {}", e);
            let msg = WsMessage::Error {
                message: format!("Database error: {}", e),
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

    // Clone terminal_id for use in recv_task
    let terminal_id_clone = terminal_id.clone();

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

    // Spawn receive task: receive from WebSocket and process
    let recv_task = tokio::spawn(async move {
        while let Some(result) = ws_receiver.next().await {
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
    });

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {
            tracing::debug!("Send task completed for terminal {}", terminal_id);
        }
        _ = recv_task => {
            tracing::debug!("Receive task completed for terminal {}", terminal_id);
        }
    }

    tracing::info!("Terminal WebSocket disconnected: {}", terminal_id);
}

#[cfg(test)]
mod tests {
    use super::*;

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
