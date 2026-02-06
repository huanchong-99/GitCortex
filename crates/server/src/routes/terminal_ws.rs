//! Terminal WebSocket routes with PTY support
//!
//! Provides WebSocket-based terminal I/O using portable-pty for cross-platform support.

use axum::{
    extract::{Path, State, WebSocketUpgrade, ws::{Message, WebSocket}},
    response::IntoResponse,
    routing::get,
    Router,
};
use db::models::{Terminal, WorkflowTask};
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

/// Idle timeout - close connection if no activity (5 minutes)
const WS_IDLE_TIMEOUT_SECS: u64 = 300;

/// Heartbeat interval for keep-alive (30 seconds)
const WS_HEARTBEAT_INTERVAL_SECS: u64 = 30;

/// PTY read buffer size
const PTY_READ_BUFFER_SIZE: usize = 4096;

// Compile-time sanity check for timeout ordering.
const _: () = {
    assert!(WS_HEARTBEAT_INTERVAL_SECS < WS_IDLE_TIMEOUT_SECS);
};

// ============================================================================
// UUID Validation
// ============================================================================

/// UUID v4 regex pattern (case-insensitive)
static UUID_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap()
});

/// Validates that terminal_id is a properly formatted UUID
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
    Router::new().route("/{terminal_id}", get(terminal_ws_handler))
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

/// Handle terminal WebSocket connection with PTY
async fn handle_terminal_socket(
    socket: WebSocket,
    terminal_id: String,
    deployment: DeploymentImpl,
) {
    tracing::info!("Terminal WebSocket connected: {}", terminal_id);

    // Split the WebSocket into sender and receiver
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Get process handle from ProcessManager
    let process_handle = deployment.process_manager()
        .get_handle(&terminal_id)
        .await;

    let process_handle = match process_handle {
        Some(handle) => handle,
        None => {
            let msg = WsMessage::Error {
                message: "Terminal process not running. Please start the terminal first.".to_string(),
            };
            let _ = ws_sender
                .send(Message::Text(serde_json::to_string(&msg).unwrap().into()))
                .await;
            let _ = ws_sender.close().await;
            tracing::warn!("Terminal {} has no running process", terminal_id);
            return;
        }
    };

    // Auto-register terminal for prompt watching if not already registered
    let prompt_watcher = deployment.prompt_watcher().clone();
    if prompt_watcher.is_registered(&terminal_id).await {
        tracing::trace!(
            terminal_id = %terminal_id,
            "Terminal already registered for prompt watching"
        );
    } else {
        match Terminal::find_by_id(&deployment.db().pool, &terminal_id).await {
            Ok(Some(terminal)) => {
                let task_id = terminal.workflow_task_id.clone();
                let pty_session_id = terminal.pty_session_id.clone();

                match WorkflowTask::find_by_id(&deployment.db().pool, &task_id).await {
                    Ok(Some(task)) => match pty_session_id {
                        Some(session_id) if !session_id.trim().is_empty() => {
                            let workflow_id = task.workflow_id;
                            prompt_watcher
                                .register(&terminal_id, &workflow_id, &task_id, &session_id)
                                .await;
                            tracing::info!(
                                terminal_id = %terminal_id,
                                workflow_id = %workflow_id,
                                task_id = %task_id,
                                pty_session_id = %session_id,
                                "Auto-registered terminal for prompt watching"
                            );
                        }
                        _ => {
                            tracing::warn!(
                                terminal_id = %terminal_id,
                                task_id = %task_id,
                                "Skipped prompt watcher auto-registration: missing pty_session_id"
                            );
                        }
                    },
                    Ok(None) => {
                        tracing::warn!(
                            terminal_id = %terminal_id,
                            workflow_task_id = %task_id,
                            "Skipped prompt watcher auto-registration: workflow task not found"
                        );
                    }
                    Err(e) => {
                        tracing::warn!(
                            terminal_id = %terminal_id,
                            workflow_task_id = %task_id,
                            error = %e,
                            "Failed to query workflow task for prompt watcher auto-registration"
                        );
                    }
                }
            }
            Ok(None) => {
                tracing::warn!(
                    terminal_id = %terminal_id,
                    "Skipped prompt watcher auto-registration: terminal not found in database"
                );
            }
            Err(e) => {
                tracing::warn!(
                    terminal_id = %terminal_id,
                    error = %e,
                    "Failed to query terminal for prompt watcher auto-registration"
                );
            }
        }
    }

    // Extract PTY reader and writer
    let reader = process_handle.reader;
    let writer = process_handle.writer;

    // Create channels for async communication
    // PTY output -> WebSocket
    let (pty_tx, mut pty_rx) = mpsc::channel::<Vec<u8>>(100);
    // WebSocket input -> PTY
    let (ws_tx, ws_rx) = mpsc::channel::<Vec<u8>>(100);

    // Clone terminal_id for tasks
    let terminal_id_reader = terminal_id.clone();
    let terminal_id_writer = terminal_id.clone();
    let terminal_id_heartbeat = terminal_id.clone();
    let terminal_id_recv = terminal_id.clone();

    // Track last activity time for idle timeout
    let last_activity = std::sync::Arc::new(tokio::sync::RwLock::new(Instant::now()));
    let last_activity_recv = last_activity.clone();
    let last_activity_heartbeat = last_activity.clone();

    // Clone process_manager for resize operations
    let process_manager = deployment.process_manager().clone();
    let terminal_id_resize = terminal_id.clone();
    let terminal_id_prompt = terminal_id.clone();

    // Spawn PTY reader task (blocking read -> async channel)
    let reader_task = if let Some(mut pty_reader) = reader {
        let tx = pty_tx.clone();
        Some(tokio::task::spawn_blocking(move || {
            let mut buf = [0u8; PTY_READ_BUFFER_SIZE];
            loop {
                match pty_reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF - PTY closed
                        tracing::debug!("PTY EOF for terminal {}", terminal_id_reader);
                        break;
                    }
                    Ok(n) => {
                        // Send data to async channel
                        if tx.blocking_send(buf[..n].to_vec()).is_err() {
                            tracing::debug!("PTY channel closed for terminal {}", terminal_id_reader);
                            break;
                        }
                    }
                    Err(e) => {
                        tracing::error!("PTY read error for terminal {}: {}", terminal_id_reader, e);
                        break;
                    }
                }
            }
        }))
    } else {
        tracing::warn!("No PTY reader available for terminal {}", terminal_id);
        None
    };

    // Spawn PTY writer task (async channel -> blocking write)
    // Writer is shared via Arc<Mutex> to support WebSocket reconnection
    let writer_task = if let Some(pty_writer) = writer {
        let mut rx = ws_rx;
        Some(tokio::task::spawn_blocking(move || {
            while let Some(data) = rx.blocking_recv() {
                // Lock the shared writer for each write operation
                // Recover from poisoned lock to allow continued input
                let mut writer_guard = match pty_writer.lock() {
                    Ok(guard) => guard,
                    Err(poisoned) => {
                        tracing::warn!(
                            "PTY writer lock was poisoned for terminal {}, recovering",
                            terminal_id_writer
                        );
                        poisoned.into_inner()
                    }
                };
                if let Err(e) = writer_guard.write_all(&data) {
                    tracing::error!("PTY write error for terminal {}: {}", terminal_id_writer, e);
                    break;
                }
                if let Err(e) = writer_guard.flush() {
                    tracing::error!("PTY flush error for terminal {}: {}", terminal_id_writer, e);
                    break;
                }
            }
        }))
    } else {
        tracing::warn!("No PTY writer available for terminal {}", terminal_id);
        None
    };

    // Spawn WebSocket send task (PTY output -> WebSocket)
    // Handles UTF-8 boundary issues with streaming decoder
    let send_task = tokio::spawn(async move {
        let mut pending_bytes: Vec<u8> = Vec::new();

        while let Some(bytes) = pty_rx.recv().await {
            // Append new bytes to pending buffer
            pending_bytes.extend_from_slice(&bytes);

            // Find the longest valid UTF-8 prefix
            let (valid_text, remaining) = decode_utf8_streaming(&pending_bytes);

            if !valid_text.is_empty() {
                // Send output to prompt watcher for detection
                prompt_watcher
                    .process_output(&terminal_id_prompt, &valid_text)
                    .await;

                let msg = WsMessage::Output { data: valid_text };
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

            // Keep remaining incomplete bytes for next iteration
            pending_bytes = remaining;
        }
    });

    // Spawn heartbeat task
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

    // Spawn WebSocket receive task (WebSocket input -> PTY)
    let recv_task = tokio::spawn(async move {
        loop {
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
                                            // Send to PTY writer
                                            if let Err(e) = ws_tx.send(data.into_bytes()).await {
                                                tracing::error!("Failed to send to PTY: {}", e);
                                                break;
                                            }
                                        }
                                        WsMessage::Resize { cols, rows } => {
                                            // Resize PTY
                                            if let Err(e) = process_manager.resize(&terminal_id_resize, cols, rows).await {
                                                tracing::warn!(
                                                    "Failed to resize terminal {}: {}",
                                                    terminal_id_resize,
                                                    e
                                                );
                                            } else {
                                                tracing::debug!(
                                                    "Terminal {} resized to {}x{}",
                                                    terminal_id_resize,
                                                    cols,
                                                    rows
                                                );
                                            }
                                        }
                                        WsMessage::Output { .. } => {
                                            tracing::warn!("Client sent unexpected Output message");
                                        }
                                        WsMessage::Error { .. } => {
                                            tracing::warn!("Client sent unexpected Error message");
                                        }
                                    }
                                } else {
                                    tracing::warn!("Failed to parse WebSocket message: {}", text);
                                }
                            }
                            Message::Close(_) => {
                                tracing::info!("Client requested close");
                                break;
                            }
                            Message::Ping(data) => {
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
                        terminal_id_recv,
                        WS_IDLE_TIMEOUT_SECS
                    );
                    break;
                }
            }
        }
    });

    // Wait for any task to complete
    // Use conditional guards to prevent immediate exit when optional tasks are None
    let reader_task_active = reader_task.is_some();
    let writer_task_active = writer_task.is_some();
    let mut reader_task = reader_task;
    let mut writer_task = writer_task;

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
        _ = async {
            if let Some(task) = &mut reader_task {
                let _ = task.await;
            }
        }, if reader_task_active => {
            tracing::debug!("PTY reader task completed for terminal {}", terminal_id);
        }
        _ = async {
            if let Some(task) = &mut writer_task {
                let _ = task.await;
            }
        }, if writer_task_active => {
            tracing::debug!("PTY writer task completed for terminal {}", terminal_id);
        }
    }

    // Abort any remaining background tasks to avoid leaks
    if let Some(task) = reader_task {
        task.abort();
    }
    if let Some(task) = writer_task {
        task.abort();
    }

    tracing::info!("Terminal WebSocket disconnected: {}", terminal_id);
}

/// Decode UTF-8 from a byte buffer, handling incomplete sequences at the end.
/// Returns (valid_string, remaining_bytes).
fn decode_utf8_streaming(bytes: &[u8]) -> (String, Vec<u8>) {
    // Try to decode the entire buffer
    match std::str::from_utf8(bytes) {
        Ok(s) => (s.to_string(), Vec::new()),
        Err(e) => {
            // Get the valid portion
            let valid_up_to = e.valid_up_to();
            let valid_str = std::str::from_utf8(&bytes[..valid_up_to])
                .unwrap_or("")
                .to_string();

            // Keep the remaining bytes (potentially incomplete UTF-8 sequence)
            let remaining = bytes[valid_up_to..].to_vec();

            (valid_str, remaining)
        }
    }
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
    }

    #[test]
    fn test_decode_utf8_streaming_complete() {
        let bytes = "Hello, World!".as_bytes();
        let (text, remaining) = decode_utf8_streaming(bytes);
        assert_eq!(text, "Hello, World!");
        assert!(remaining.is_empty());
    }

    #[test]
    fn test_decode_utf8_streaming_incomplete() {
        // UTF-8 for "你好" is [228, 189, 160, 229, 165, 189]
        // Incomplete sequence: first character complete, second incomplete
        let bytes = vec![228, 189, 160, 229, 165]; // "你" + incomplete "好"
        let (text, remaining) = decode_utf8_streaming(&bytes);
        assert_eq!(text, "你");
        assert_eq!(remaining, vec![229, 165]);
    }

    #[test]
    fn test_decode_utf8_streaming_empty() {
        let bytes: &[u8] = &[];
        let (text, remaining) = decode_utf8_streaming(bytes);
        assert!(text.is_empty());
        assert!(remaining.is_empty());
    }

    #[test]
    fn test_validate_terminal_id_valid() {
        assert!(validate_terminal_id("550e8400-e29b-41d4-a716-446655440000").is_ok());
        assert!(validate_terminal_id("550E8400-E29B-41D4-A716-446655440000").is_ok());
    }

    #[test]
    fn test_validate_terminal_id_invalid() {
        assert!(validate_terminal_id("invalid").is_err());
        assert!(validate_terminal_id("550e8400-e29b-41d4-a716").is_err());
        assert!(validate_terminal_id("").is_err());
    }
}
