//! WebSocket event model for workflow event broadcasting.
//!
//! Defines the event structure and types for real-time workflow updates.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use services::services::orchestrator::BusMessage;
use ts_rs::TS;
use uuid::Uuid;

// ============================================================================
// Event Types
// ============================================================================

/// WebSocket event types following namespace convention.
///
/// Format: `{category}.{action}` (e.g., `workflow.status_changed`)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Eq, PartialEq, TS)]
#[serde(rename_all = "snake_case")]
pub enum WsEventType {
    /// Workflow status changed (ready -> running -> completed/failed)
    #[serde(rename = "workflow.status_changed")]
    WorkflowStatusChanged,

    /// Terminal status changed (waiting -> working -> completed/failed)
    #[serde(rename = "terminal.status_changed")]
    TerminalStatusChanged,

    /// Task status changed (pending -> running -> completed/failed)
    #[serde(rename = "task.status_changed")]
    TaskStatusChanged,

    /// Terminal completed with result
    #[serde(rename = "terminal.completed")]
    TerminalCompleted,

    /// Git commit detected in repository
    #[serde(rename = "git.commit_detected")]
    GitCommitDetected,

    /// Orchestrator awakened and processing
    #[serde(rename = "orchestrator.awakened")]
    OrchestratorAwakened,

    /// Orchestrator made a decision
    #[serde(rename = "orchestrator.decision")]
    OrchestratorDecision,

    /// System heartbeat for connection keep-alive
    #[serde(rename = "system.heartbeat")]
    SystemHeartbeat,

    /// Receiver lagged and missed messages
    #[serde(rename = "system.lagged")]
    SystemLagged,

    /// System error occurred
    #[serde(rename = "system.error")]
    SystemError,

    /// Terminal prompt detected (interactive prompt requiring response)
    #[serde(rename = "terminal.prompt_detected")]
    TerminalPromptDetected,

    /// Terminal prompt decision made by Orchestrator
    #[serde(rename = "terminal.prompt_decision")]
    TerminalPromptDecision,
}

// ============================================================================
// Event Structure
// ============================================================================

/// WebSocket event structure following design specification.
///
/// All events follow the format: `{type, payload, timestamp, id}`
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct WsEvent {
    /// Event type (e.g., "workflow.status_changed")
    #[serde(rename = "type")]
    pub event_type: WsEventType,

    /// Event payload (varies by event type)
    pub payload: Value,

    /// ISO 8601 timestamp when event was created
    pub timestamp: DateTime<Utc>,

    /// Unique event identifier for deduplication
    pub id: String,
}

impl WsEvent {
    /// Create a new WebSocket event with auto-generated ID and timestamp.
    pub fn new(event_type: WsEventType, payload: Value) -> Self {
        Self {
            event_type,
            payload,
            timestamp: Utc::now(),
            id: format!("evt_{}", Uuid::new_v4()),
        }
    }

    /// Create a heartbeat event.
    pub fn heartbeat() -> Self {
        Self::new(WsEventType::SystemHeartbeat, json!({}))
    }

    /// Create a lagged event indicating missed messages.
    pub fn lagged(skipped: u64) -> Self {
        Self::new(WsEventType::SystemLagged, json!({ "skipped": skipped }))
    }

    /// Create an error event.
    pub fn error(message: impl Into<String>) -> Self {
        Self::new(
            WsEventType::SystemError,
            json!({ "message": message.into() }),
        )
    }

    /// Convert a BusMessage into a workflow-scoped WebSocket event.
    ///
    /// Returns `Some((workflow_id, event))` when the message can be routed,
    /// or `None` for messages that don't map to WebSocket events.
    pub fn try_from_bus_message(message: BusMessage) -> Option<(String, Self)> {
        match message {
            BusMessage::StatusUpdate {
                workflow_id,
                status,
            } => {
                let payload = json!({
                    "workflowId": workflow_id,
                    "status": status
                });
                Some((
                    workflow_id,
                    Self::new(WsEventType::WorkflowStatusChanged, payload),
                ))
            }

            BusMessage::TerminalStatusUpdate {
                workflow_id,
                terminal_id,
                status,
            } => {
                let payload = json!({
                    "workflowId": workflow_id,
                    "terminalId": terminal_id,
                    "status": status
                });
                Some((
                    workflow_id,
                    Self::new(WsEventType::TerminalStatusChanged, payload),
                ))
            }

            BusMessage::TaskStatusUpdate {
                workflow_id,
                task_id,
                status,
            } => {
                let payload = json!({
                    "workflowId": workflow_id,
                    "taskId": task_id,
                    "status": status
                });
                Some((
                    workflow_id,
                    Self::new(WsEventType::TaskStatusChanged, payload),
                ))
            }

            BusMessage::TerminalCompleted(event) => {
                let workflow_id = event.workflow_id.clone();
                let payload = serde_json::to_value(&event).unwrap_or_else(|_| {
                    json!({
                        "workflowId": workflow_id,
                        "error": "serialization_failed"
                    })
                });
                Some((
                    workflow_id,
                    Self::new(WsEventType::TerminalCompleted, payload),
                ))
            }

            BusMessage::GitEvent {
                workflow_id,
                commit_hash,
                branch,
                message,
            } => {
                let payload = json!({
                    "workflowId": workflow_id,
                    "commitHash": commit_hash,
                    "branch": branch,
                    "message": message
                });
                Some((
                    workflow_id,
                    Self::new(WsEventType::GitCommitDetected, payload),
                ))
            }

            BusMessage::Error { workflow_id, error } => {
                let payload = json!({
                    "workflowId": workflow_id,
                    "error": error
                });
                Some((workflow_id, Self::new(WsEventType::SystemError, payload)))
            }

            // Terminal prompt events - forward to WebSocket for UI updates
            BusMessage::TerminalPromptDetected(event) => {
                let workflow_id = event.workflow_id.clone();
                let payload = json!({
                    "workflowId": workflow_id,
                    "terminalId": event.terminal_id,
                    "promptKind": format!("{:?}", event.prompt.kind),
                    "promptText": event.prompt.raw_text,
                    "confidence": event.prompt.confidence,
                    "hasDangerousKeywords": event.prompt.has_dangerous_keywords,
                    "options": event.prompt.options,
                    "selectedIndex": event.prompt.selected_index
                });
                Some((
                    workflow_id,
                    Self::new(WsEventType::TerminalPromptDetected, payload),
                ))
            }

            BusMessage::TerminalPromptDecision {
                terminal_id,
                workflow_id,
                decision,
            } => {
                let payload = json!({
                    "workflowId": workflow_id,
                    "terminalId": terminal_id,
                    "decision": decision
                });
                Some((
                    workflow_id,
                    Self::new(WsEventType::TerminalPromptDecision, payload),
                ))
            }

            // Messages that don't map to WebSocket events
            BusMessage::Instruction(_) => None,
            BusMessage::TerminalMessage { .. } => None,
            BusMessage::TerminalInput { .. } => None, // Internal message, not for WebSocket
            BusMessage::Shutdown => None,
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use services::services::orchestrator::types::{
        TerminalCompletionEvent, TerminalCompletionStatus,
    };

    use super::*;

    #[test]
    fn test_ws_event_serialization() {
        let event = WsEvent::new(
            WsEventType::WorkflowStatusChanged,
            json!({"workflowId": "123", "status": "running"}),
        );

        let json = serde_json::to_string(&event).unwrap();

        assert!(json.contains("workflow.status_changed"));
        assert!(json.contains("timestamp"));
        assert!(json.contains("evt_"));
        assert!(json.contains("workflowId"));
    }

    #[test]
    fn test_ws_event_deserialization() {
        let json = r#"{
            "type": "workflow.status_changed",
            "payload": {"workflowId": "123", "status": "running"},
            "timestamp": "2026-02-04T12:00:00Z",
            "id": "evt_test123"
        }"#;

        let event: WsEvent = serde_json::from_str(json).unwrap();

        assert_eq!(event.event_type, WsEventType::WorkflowStatusChanged);
        assert_eq!(event.id, "evt_test123");
    }

    #[test]
    fn test_heartbeat_event() {
        let event = WsEvent::heartbeat();

        assert_eq!(event.event_type, WsEventType::SystemHeartbeat);
        assert!(event.id.starts_with("evt_"));
    }

    #[test]
    fn test_lagged_event() {
        let event = WsEvent::lagged(5);

        assert_eq!(event.event_type, WsEventType::SystemLagged);
        assert_eq!(event.payload["skipped"], 5);
    }

    #[test]
    fn test_error_event() {
        let event = WsEvent::error("Test error message");

        assert_eq!(event.event_type, WsEventType::SystemError);
        assert_eq!(event.payload["message"], "Test error message");
    }

    #[test]
    fn test_bus_message_status_update_conversion() {
        let bus_msg = BusMessage::StatusUpdate {
            workflow_id: "wf-123".to_string(),
            status: "running".to_string(),
        };

        let result = WsEvent::try_from_bus_message(bus_msg);

        assert!(result.is_some());
        let (workflow_id, event) = result.unwrap();
        assert_eq!(workflow_id, "wf-123");
        assert_eq!(event.event_type, WsEventType::WorkflowStatusChanged);
        assert_eq!(event.payload["status"], "running");
    }

    #[test]
    fn test_bus_message_terminal_status_conversion() {
        let bus_msg = BusMessage::TerminalStatusUpdate {
            workflow_id: "wf-123".to_string(),
            terminal_id: "term-456".to_string(),
            status: "working".to_string(),
        };

        let result = WsEvent::try_from_bus_message(bus_msg);

        assert!(result.is_some());
        let (workflow_id, event) = result.unwrap();
        assert_eq!(workflow_id, "wf-123");
        assert_eq!(event.event_type, WsEventType::TerminalStatusChanged);
        assert_eq!(event.payload["terminalId"], "term-456");
    }

    #[test]
    fn test_bus_message_git_event_conversion() {
        let bus_msg = BusMessage::GitEvent {
            workflow_id: "wf-123".to_string(),
            commit_hash: "abc123".to_string(),
            branch: "main".to_string(),
            message: "feat: add feature".to_string(),
        };

        let result = WsEvent::try_from_bus_message(bus_msg);

        assert!(result.is_some());
        let (workflow_id, event) = result.unwrap();
        assert_eq!(workflow_id, "wf-123");
        assert_eq!(event.event_type, WsEventType::GitCommitDetected);
        assert_eq!(event.payload["commitHash"], "abc123");
    }

    #[test]
    fn test_bus_message_terminal_completed_conversion() {
        let bus_msg = BusMessage::TerminalCompleted(TerminalCompletionEvent {
            workflow_id: "wf-123".to_string(),
            task_id: "task-456".to_string(),
            terminal_id: "term-789".to_string(),
            status: TerminalCompletionStatus::Completed,
            commit_hash: Some("abc123".to_string()),
            commit_message: Some("feat: done".to_string()),
            metadata: None,
        });

        let result = WsEvent::try_from_bus_message(bus_msg);

        assert!(result.is_some());
        let (workflow_id, event) = result.unwrap();
        assert_eq!(workflow_id, "wf-123");
        assert_eq!(event.event_type, WsEventType::TerminalCompleted);
    }

    #[test]
    fn test_bus_message_shutdown_not_converted() {
        let bus_msg = BusMessage::Shutdown;
        let result = WsEvent::try_from_bus_message(bus_msg);
        assert!(result.is_none());
    }

    #[test]
    fn test_bus_message_terminal_message_not_converted() {
        let bus_msg = BusMessage::TerminalMessage {
            message: "test".to_string(),
        };
        let result = WsEvent::try_from_bus_message(bus_msg);
        assert!(result.is_none());
    }

    #[test]
    fn test_all_event_types_serialize() {
        let types = vec![
            WsEventType::WorkflowStatusChanged,
            WsEventType::TerminalStatusChanged,
            WsEventType::TaskStatusChanged,
            WsEventType::TerminalCompleted,
            WsEventType::GitCommitDetected,
            WsEventType::OrchestratorAwakened,
            WsEventType::OrchestratorDecision,
            WsEventType::SystemHeartbeat,
            WsEventType::SystemLagged,
            WsEventType::SystemError,
        ];

        for event_type in types {
            let event = WsEvent::new(event_type, json!({}));
            let json = serde_json::to_string(&event).unwrap();
            assert!(
                json.contains("."),
                "Event type should contain dot: {:?}",
                event_type
            );
        }
    }
}
