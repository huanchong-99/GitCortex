//! Message bus for orchestrator events.

use std::{collections::HashMap, sync::Arc};

use tokio::sync::{RwLock, broadcast, mpsc};

use super::constants::WORKFLOW_TOPIC_PREFIX;
use super::types::{OrchestratorInstruction, PromptDecision, TerminalCompletionEvent, TerminalPromptEvent};

const TERMINAL_INPUT_TOPIC_PREFIX: &str = "terminal.input.";

/// Messages routed through the orchestrator bus.
#[allow(clippy::large_enum_variant)]
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
    /// Terminal status update
    TerminalStatusUpdate {
        workflow_id: String,
        terminal_id: String,
        status: String,
    },
    /// Task status update
    TaskStatusUpdate {
        workflow_id: String,
        task_id: String,
        status: String,
    },
    Error {
        workflow_id: String,
        error: String,
    },
    TerminalMessage {
        message: String,
    },
    /// Terminal prompt detected - sent by PromptWatcher when a prompt is detected
    TerminalPromptDetected(TerminalPromptEvent),
    /// Terminal input - sent to PTY stdin via TerminalBridge
    TerminalInput {
        terminal_id: String,
        session_id: String,
        input: String,
        /// Decision that led to this input (for logging/debugging)
        decision: Option<PromptDecision>,
    },
    /// Terminal prompt decision made - for UI updates
    TerminalPromptDecision {
        terminal_id: String,
        workflow_id: String,
        decision: PromptDecision,
    },
    Shutdown,
}

/// In-memory pub/sub bus for workflow and terminal events.
#[derive(Clone)]
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

    #[allow(clippy::result_large_err)]
    pub fn broadcast(
        &self,
        message: BusMessage,
    ) -> Result<usize, broadcast::error::SendError<BusMessage>> {
        self.broadcast_tx.send(message)
    }

    pub fn subscribe_broadcast(&self) -> broadcast::Receiver<BusMessage> {
        self.broadcast_tx.subscribe()
    }

    /// Subscribe to a topic-specific mpsc stream.
    pub async fn subscribe(&self, topic: &str) -> mpsc::Receiver<BusMessage> {
        let (tx, rx) = mpsc::channel(100);
        let mut subscribers: tokio::sync::RwLockWriteGuard<
            '_,
            HashMap<String, Vec<mpsc::Sender<BusMessage>>>,
        > = self.subscribers.write().await;
        subscribers.entry(topic.to_string()).or_default().push(tx);
        rx
    }

    /// Publish a message to all subscribers of a topic.
    pub async fn publish(&self, topic: &str, message: BusMessage) -> anyhow::Result<()> {
        let subscribers: tokio::sync::RwLockReadGuard<
            '_,
            HashMap<String, Vec<mpsc::Sender<BusMessage>>>,
        > = self.subscribers.read().await;
        if let Some(subs) = subscribers.get(topic) {
            for tx in subs {
                tx.send(message.clone())
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to send message to subscriber: {e}"))?;
            }
        }
        Ok(())
    }

    /// Publishes a terminal completion event to workflow topic and broadcast channel.
    pub async fn publish_terminal_completed(&self, event: TerminalCompletionEvent) {
        let topic = format!("{}{}", WORKFLOW_TOPIC_PREFIX, event.workflow_id);
        let _ = self.publish(&topic, BusMessage::TerminalCompleted(event.clone()))
            .await;
        let _ = self.broadcast(BusMessage::TerminalCompleted(event));
    }

    /// Publishes a git event to workflow topic and broadcast channel.
    ///
    /// This is called when a new commit is detected in the repository.
    /// For commits without METADATA, this triggers the orchestrator to wake up
    /// and make a decision about the next action.
    pub async fn publish_git_event(
        &self,
        workflow_id: &str,
        commit_hash: &str,
        branch: &str,
        message: &str,
    ) {
        let topic = format!("{}{}", WORKFLOW_TOPIC_PREFIX, workflow_id);
        let event = BusMessage::GitEvent {
            workflow_id: workflow_id.to_string(),
            commit_hash: commit_hash.to_string(),
            branch: branch.to_string(),
            message: message.to_string(),
        };
        let _ = self.publish(&topic, event.clone()).await;
        let _ = self.broadcast(event);
    }

    /// Publishes a terminal prompt detected event.
    ///
    /// Called by PromptWatcher when an interactive prompt is detected in PTY output.
    pub async fn publish_terminal_prompt_detected(&self, event: TerminalPromptEvent) {
        let topic = format!("{}{}", WORKFLOW_TOPIC_PREFIX, event.workflow_id);
        let _ = self.publish(&topic, BusMessage::TerminalPromptDetected(event.clone()))
            .await;
        let _ = self.broadcast(BusMessage::TerminalPromptDetected(event));
    }

    /// Publishes a terminal input message to be sent to PTY stdin.
    ///
    /// Called by Orchestrator after making a decision about how to respond to a prompt.
    pub async fn publish_terminal_input(
        &self,
        terminal_id: &str,
        session_id: &str,
        input: &str,
        decision: Option<PromptDecision>,
    ) {
        let message = BusMessage::TerminalInput {
            terminal_id: terminal_id.to_string(),
            session_id: session_id.to_string(),
            input: input.to_string(),
            decision,
        };
        // Publish to terminal-specific topic for targeted routing
        let topic = format!("{}{}", TERMINAL_INPUT_TOPIC_PREFIX, terminal_id);
        let _ = self.publish(&topic, message.clone()).await;
        // Also broadcast for legacy compatibility
        let _ = self.broadcast(message);
    }

    /// Publishes a terminal prompt decision for UI updates.
    ///
    /// Called by Orchestrator to notify UI about the decision made for a prompt.
    pub async fn publish_terminal_prompt_decision(
        &self,
        terminal_id: &str,
        workflow_id: &str,
        decision: PromptDecision,
    ) {
        let topic = format!("{}{}", WORKFLOW_TOPIC_PREFIX, workflow_id);
        let message = BusMessage::TerminalPromptDecision {
            terminal_id: terminal_id.to_string(),
            workflow_id: workflow_id.to_string(),
            decision: decision.clone(),
        };
        let _ = self.publish(&topic, message.clone()).await;
        let _ = self.broadcast(message);
    }
}

impl Default for MessageBus {
    fn default() -> Self {
        Self::new(1000)
    }
}

pub type SharedMessageBus = Arc<MessageBus>;
