//! Workflow WebSocket route for real-time event streaming.
//!
//! Provides a WebSocket endpoint for clients to subscribe to workflow events.
//! Events include workflow status changes, terminal updates, git commits, etc.

use axum::{
    Extension, Router,
    extract::{
        Path, State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::IntoResponse,
    routing::get,
};
use futures_util::{SinkExt, StreamExt};
use tokio::{
    sync::broadcast,
    time::{Duration, interval},
};
use tracing::{debug, info, warn};

use super::{
    subscription_hub::SharedSubscriptionHub, terminal_ws::validate_terminal_id,
    workflow_events::WsEvent,
};
use crate::{DeploymentImpl, error::ApiError};

// ============================================================================
// Constants
// ============================================================================

/// Heartbeat interval for keep-alive (30 seconds).
const WS_HEARTBEAT_INTERVAL_SECS: u64 = 30;

// ============================================================================
// Route Definition
// ============================================================================

/// Create workflow WebSocket routes.
///
/// Routes:
/// - `GET /workflow/:id/events` - Subscribe to workflow events
pub fn workflow_ws_routes() -> Router<DeploymentImpl> {
    Router::new().route("/workflow/{id}/events", get(workflow_ws_handler))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// WebSocket handler for workflow event subscription.
async fn workflow_ws_handler(
    ws: WebSocketUpgrade,
    Path(workflow_id): Path<String>,
    State(_deployment): State<DeploymentImpl>,
    Extension(hub): Extension<SharedSubscriptionHub>,
) -> impl IntoResponse {
    // Validate workflow_id format (UUID)
    if let Err(e) = validate_terminal_id(&workflow_id) {
        warn!("Invalid workflow_id format: {} - {}", workflow_id, e);
        return ApiError::BadRequest(format!("Invalid workflow_id format: {e}")).into_response();
    }

    ws.on_upgrade(move |socket| handle_workflow_socket(socket, workflow_id, hub))
}

/// Handle workflow WebSocket connection.
async fn handle_workflow_socket(
    socket: WebSocket,
    workflow_id: String,
    hub: SharedSubscriptionHub,
) {
    info!("Workflow WS connected: {}", workflow_id);

    // Subscribe to workflow events
    let mut receiver = hub.subscribe(&workflow_id).await;
    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Heartbeat interval
    let mut heartbeat = interval(Duration::from_secs(WS_HEARTBEAT_INTERVAL_SECS));

    // Clone for cleanup
    let workflow_id_cleanup = workflow_id.clone();
    let hub_cleanup = hub.clone();

    // Send task: forwards events from hub to WebSocket
    let send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                // Send heartbeat periodically
                _ = heartbeat.tick() => {
                    let event = WsEvent::heartbeat();
                    if !send_ws_event(&mut ws_sender, &event).await {
                        debug!("Failed to send heartbeat, closing connection");
                        break;
                    }
                }

                // Forward events from subscription hub
                msg = receiver.recv() => {
                    match msg {
                        Ok(event) => {
                            if !send_ws_event(&mut ws_sender, &event).await {
                                debug!("Failed to send event, closing connection");
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(skipped)) => {
                            warn!("Workflow WS receiver lagged, skipped {} messages", skipped);
                            let lagged_event = WsEvent::lagged(skipped);
                            if !send_ws_event(&mut ws_sender, &lagged_event).await {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            debug!("Subscription hub closed");
                            break;
                        }
                    }
                }
            }
        }
    });

    // Receive task: handles incoming messages from client
    let recv_task = tokio::spawn(async move {
        while let Some(result) = ws_receiver.next().await {
            match result {
                Ok(Message::Close(_)) => {
                    debug!("Client requested close");
                    break;
                }
                Ok(Message::Ping(_)) => {
                    // Ping handled automatically by axum
                }
                Ok(Message::Pong(_)) => {
                    // Pong received
                }
                Ok(Message::Text(_)) => {
                    // Client messages are ignored for now
                    // Could be used for client-side heartbeat or commands
                }
                Ok(Message::Binary(_)) => {
                    // Binary messages not supported
                }
                Err(e) => {
                    debug!("WebSocket error: {}", e);
                    break;
                }
            }
        }
    });

    // Wait for either task to complete
    tokio::select! {
        _ = send_task => {
            debug!("Send task completed for workflow {}", workflow_id_cleanup);
        }
        _ = recv_task => {
            debug!("Receive task completed for workflow {}", workflow_id_cleanup);
        }
    }

    // Cleanup: remove channel if no more subscribers
    hub_cleanup.cleanup_if_idle(&workflow_id_cleanup).await;

    info!("Workflow WS disconnected: {}", workflow_id_cleanup);
}

/// Send a WebSocket event to the client.
///
/// Returns `true` if successful, `false` if the connection should be closed.
async fn send_ws_event(
    ws_sender: &mut futures_util::stream::SplitSink<WebSocket, Message>,
    event: &WsEvent,
) -> bool {
    let json = match serde_json::to_string(event) {
        Ok(json) => json,
        Err(err) => {
            warn!("Failed to serialize WsEvent: {}", err);
            return false;
        }
    };

    ws_sender.send(Message::Text(json.into())).await.is_ok()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workflow_ws_routes_created() {
        // Verify routes can be created without panic
        let _routes = workflow_ws_routes();
    }
}
