//! 消息总线

use std::{collections::HashMap, sync::Arc};

use tokio::sync::{RwLock, broadcast, mpsc};

use super::{
    constants::*,
    types::*,
};

#[derive(Debug, Clone)]
pub enum BusMessage {
    TerminalCompleted(TerminalCompletionEvent),
    GitEvent {
        workflow_id: String,
        commit_hash: String,
        branch: String,
        message: String,
    },
    Instruction(OrchestratorInstruction),
    StatusUpdate {
        workflow_id: String,
        status: String,
    },
    Error {
        workflow_id: String,
        error: String,
    },
    TerminalMessage {
        message: String,
    },
    Shutdown,
}

pub struct MessageBus {
    broadcast_tx: broadcast::Sender<BusMessage>,
    subscribers: Arc<RwLock<HashMap<String, Vec<mpsc::Sender<BusMessage>>>>>,
}

impl MessageBus {
    pub fn new(capacity: usize) -> Self {
        let (broadcast_tx, _) = broadcast::channel(capacity);
        Self {
            broadcast_tx,
            subscribers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn broadcast(
        &self,
        message: BusMessage,
    ) -> Result<usize, broadcast::error::SendError<BusMessage>> {
        self.broadcast_tx.send(message)
    }

    pub fn subscribe_broadcast(&self) -> broadcast::Receiver<BusMessage> {
        self.broadcast_tx.subscribe()
    }

    pub async fn subscribe(&self, topic: &str) -> mpsc::Receiver<BusMessage> {
        let (tx, rx) = mpsc::channel(100);
        let mut subscribers: tokio::sync::RwLockWriteGuard<
            '_,
            HashMap<String, Vec<mpsc::Sender<BusMessage>>>,
        > = self.subscribers.write().await;
        subscribers.entry(topic.to_string()).or_default().push(tx);
        rx
    }

    pub async fn publish(&self, topic: &str, message: BusMessage) -> anyhow::Result<()> {
        let subscribers: tokio::sync::RwLockReadGuard<
            '_,
            HashMap<String, Vec<mpsc::Sender<BusMessage>>>,
        > = self.subscribers.read().await;
        if let Some(subs) = subscribers.get(topic) {
            for tx in subs {
                tx.send(message.clone())
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to send message to subscriber: {}", e))?;
            }
        }
        Ok(())
    }

    pub async fn publish_terminal_completed(&self, event: TerminalCompletionEvent) {
        let topic = format!("{}{}", WORKFLOW_TOPIC_PREFIX, event.workflow_id);
        let _ = self.publish(&topic, BusMessage::TerminalCompleted(event.clone()))
            .await;
        let _ = self.broadcast(BusMessage::TerminalCompleted(event));
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new(1000)
    }
}

pub type SharedMessageBus = Arc<MessageBus>;
