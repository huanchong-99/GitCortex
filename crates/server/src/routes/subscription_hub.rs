//! Per-workflow subscription hub for WebSocket event broadcasting.
//!
//! Manages broadcast channels for each workflow, allowing multiple WebSocket
//! connections to subscribe to events for a specific workflow.

use std::{collections::HashMap, sync::Arc};

use tokio::sync::{broadcast, RwLock};

use super::workflow_events::WsEvent;

// ============================================================================
// Constants
// ============================================================================

/// Default capacity for per-workflow broadcast channels.
const DEFAULT_CHANNEL_CAPACITY: usize = 256;

// ============================================================================
// Subscription Hub
// ============================================================================

/// Per-workflow broadcast hub for WebSocket events.
///
/// Each workflow has its own broadcast channel. When a WebSocket client
/// connects to a workflow, it subscribes to that workflow's channel.
/// Events are then broadcast to all subscribers of that workflow.
#[derive(Clone)]
pub struct SubscriptionHub {
    /// Capacity for each broadcast channel.
    capacity: usize,
    /// Map of workflow_id -> broadcast sender.
    senders: Arc<RwLock<HashMap<String, broadcast::Sender<WsEvent>>>>,
}

/// Shared subscription hub type alias.
pub type SharedSubscriptionHub = Arc<SubscriptionHub>;

impl SubscriptionHub {
    /// Create a new subscription hub with the specified channel capacity.
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            senders: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Subscribe to events for a specific workflow.
    ///
    /// Returns a receiver that will receive all events published to this workflow.
    pub async fn subscribe(&self, workflow_id: &str) -> broadcast::Receiver<WsEvent> {
        let sender = self.get_or_create_sender(workflow_id).await;
        sender.subscribe()
    }

    /// Publish an event to all subscribers of a workflow.
    ///
    /// Returns the number of receivers that received the event, or an error
    /// if there are no active subscribers.
    pub async fn publish(
        &self,
        workflow_id: &str,
        event: WsEvent,
    ) -> Result<usize, broadcast::error::SendError<WsEvent>> {
        let sender = self.get_or_create_sender(workflow_id).await;
        sender.send(event)
    }

    /// Get the number of active subscribers for a workflow.
    pub async fn subscriber_count(&self, workflow_id: &str) -> usize {
        let senders = self.senders.read().await;
        senders
            .get(workflow_id)
            .map_or(0, broadcast::Sender::receiver_count)
    }

    /// Check if a workflow has any active subscribers.
    pub async fn has_subscribers(&self, workflow_id: &str) -> bool {
        self.subscriber_count(workflow_id).await > 0
    }

    /// Clean up the channel for a workflow if it has no subscribers.
    ///
    /// This should be called when a WebSocket connection closes to prevent
    /// memory leaks from unused channels.
    pub async fn cleanup_if_idle(&self, workflow_id: &str) {
        let mut senders = self.senders.write().await;
        let should_remove = senders
            .get(workflow_id)
            .map_or(false, |sender| sender.receiver_count() == 0);

        if should_remove {
            senders.remove(workflow_id);
            tracing::debug!("Cleaned up idle channel for workflow: {}", workflow_id);
        }
    }

    /// Get the number of active workflow channels.
    pub async fn channel_count(&self) -> usize {
        self.senders.read().await.len()
    }

    /// Get or create a broadcast sender for a workflow.
    async fn get_or_create_sender(&self, workflow_id: &str) -> broadcast::Sender<WsEvent> {
        // Fast path: check if sender already exists
        if let Some(sender) = self.senders.read().await.get(workflow_id).cloned() {
            return sender;
        }

        // Slow path: create new sender
        let mut senders = self.senders.write().await;

        // Double-check after acquiring write lock
        if let Some(sender) = senders.get(workflow_id).cloned() {
            return sender;
        }

        // Create new channel
        let (sender, _) = broadcast::channel(self.capacity);
        senders.insert(workflow_id.to_string(), sender.clone());
        tracing::debug!("Created new channel for workflow: {}", workflow_id);

        sender
    }
}

impl Default for SubscriptionHub {
    fn default() -> Self {
        Self::new(DEFAULT_CHANNEL_CAPACITY)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    use super::super::workflow_events::WsEventType;

    #[tokio::test]
    async fn test_subscription_hub_creation() {
        let hub = SubscriptionHub::new(100);
        assert_eq!(hub.channel_count().await, 0);
    }

    #[tokio::test]
    async fn test_subscribe_creates_channel() {
        let hub = SubscriptionHub::new(100);

        let _rx = hub.subscribe("workflow-1").await;

        assert!(hub.has_subscribers("workflow-1").await);
        assert_eq!(hub.subscriber_count("workflow-1").await, 1);
        assert_eq!(hub.channel_count().await, 1);
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let hub = SubscriptionHub::new(100);

        let _rx1 = hub.subscribe("workflow-1").await;
        let _rx2 = hub.subscribe("workflow-1").await;
        let _rx3 = hub.subscribe("workflow-1").await;

        assert_eq!(hub.subscriber_count("workflow-1").await, 3);
    }

    #[tokio::test]
    async fn test_publish_to_subscribers() {
        let hub = SubscriptionHub::new(100);

        let mut rx1 = hub.subscribe("workflow-1").await;
        let mut rx2 = hub.subscribe("workflow-1").await;

        let event = WsEvent::new(
            WsEventType::WorkflowStatusChanged,
            json!({"status": "running"}),
        );

        let result = hub.publish("workflow-1", event.clone()).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 2); // 2 receivers

        // Both receivers should get the event
        let received1 = rx1.recv().await.unwrap();
        let received2 = rx2.recv().await.unwrap();

        assert_eq!(received1.event_type, WsEventType::WorkflowStatusChanged);
        assert_eq!(received2.event_type, WsEventType::WorkflowStatusChanged);
    }

    #[tokio::test]
    async fn test_workflow_isolation() {
        let hub = SubscriptionHub::new(100);

        let mut rx1 = hub.subscribe("workflow-1").await;
        let mut rx2 = hub.subscribe("workflow-2").await;

        let event = WsEvent::new(WsEventType::SystemHeartbeat, json!({}));

        // Publish to workflow-1 only
        hub.publish("workflow-1", event).await.unwrap();

        // workflow-1 should receive
        let result1 = tokio::time::timeout(
            std::time::Duration::from_millis(100),
            rx1.recv(),
        )
        .await;
        assert!(result1.is_ok());

        // workflow-2 should NOT receive (timeout)
        let result2 = tokio::time::timeout(
            std::time::Duration::from_millis(100),
            rx2.recv(),
        )
        .await;
        assert!(result2.is_err()); // Timeout
    }

    #[tokio::test]
    async fn test_cleanup_if_idle() {
        let hub = SubscriptionHub::new(100);

        {
            let _rx = hub.subscribe("workflow-1").await;
            assert!(hub.has_subscribers("workflow-1").await);
        }
        // rx dropped here

        // Channel still exists but has no subscribers
        hub.cleanup_if_idle("workflow-1").await;

        // Channel should be removed
        assert_eq!(hub.channel_count().await, 0);
    }

    #[tokio::test]
    async fn test_cleanup_with_active_subscribers() {
        let hub = SubscriptionHub::new(100);

        let _rx = hub.subscribe("workflow-1").await;

        // Try to cleanup while subscriber is active
        hub.cleanup_if_idle("workflow-1").await;

        // Channel should NOT be removed
        assert!(hub.has_subscribers("workflow-1").await);
        assert_eq!(hub.channel_count().await, 1);
    }

    #[tokio::test]
    async fn test_publish_no_subscribers() {
        let hub = SubscriptionHub::new(100);

        let event = WsEvent::heartbeat();
        let result = hub.publish("workflow-1", event).await;

        // Should fail because no subscribers
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_default_hub() {
        let hub = SubscriptionHub::default();
        assert_eq!(hub.capacity, DEFAULT_CHANNEL_CAPACITY);
    }
}
