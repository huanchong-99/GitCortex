//! Workflow event monitoring for completion reports and progress push.

use std::sync::Arc;

use sqlx::SqlitePool;
use tokio::sync::mpsc;
use tracing;

use super::sync::{ConciergeBroadcaster, ConciergeEvent};
use db::models::concierge::{ConciergeMessage, ConciergeSession};

/// Subscribe to a workflow's message bus and forward relevant events
/// to the Concierge session as system messages.
///
/// Always pushes completion summaries; optionally pushes progress events.
pub async fn watch_workflow_events(
    session_id: String,
    _workflow_id: String,
    pool: SqlitePool,
    broadcaster: Arc<ConciergeBroadcaster>,
    mut workflow_rx: mpsc::Receiver<crate::services::orchestrator::message_bus::BusMessage>,
) {
    use crate::services::orchestrator::message_bus::BusMessage;

    while let Some(bus_msg) = workflow_rx.recv().await {
        // Reload session to check current settings
        let session = match ConciergeSession::find_by_id(&pool, &session_id).await {
            Ok(Some(s)) => s,
            _ => continue,
        };

        let (text, is_progress) = match &bus_msg {
            BusMessage::TerminalCompleted(event) => {
                let status_str = format!("{:?}", event.status);
                (
                    format!(
                        "[Task Update] Terminal {} {} (task: {})",
                        event.terminal_id, status_str, event.task_id
                    ),
                    false,
                )
            }
            BusMessage::TaskStatusUpdate {
                task_id, status, ..
            } if status == "completed" || status == "failed" => (
                format!("[Task Update] Task {task_id} {status}"),
                false,
            ),
            BusMessage::GitEvent {
                commit_hash,
                branch,
                message,
                ..
            } => (
                format!(
                    "[Git] Commit {} on {}: {}",
                    &commit_hash[..8.min(commit_hash.len())],
                    branch,
                    message
                ),
                true,
            ),
            BusMessage::TerminalStatusUpdate {
                terminal_id,
                status,
                ..
            } => (
                format!("[Terminal] {terminal_id} → {status}"),
                true,
            ),
            BusMessage::Shutdown => {
                tracing::debug!(
                    session_id = %session_id,
                    "Workflow shut down, stopping notification watcher"
                );
                break;
            }
            _ => continue,
        };

        // Skip progress events if notifications are disabled
        if is_progress && !session.progress_notifications {
            continue;
        }

        // Save as system message and broadcast
        let msg = ConciergeMessage::new_system(&session_id, &text);
        if let Err(e) = ConciergeMessage::insert(&pool, &msg).await {
            tracing::warn!("Failed to save notification message: {e}");
            continue;
        }

        broadcaster
            .broadcast(
                &session_id,
                ConciergeEvent::NewMessage { message: msg },
                session.feishu_sync,
                None,
            )
            .await;
    }
}
