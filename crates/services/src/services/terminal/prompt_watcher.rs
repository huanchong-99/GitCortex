//! Terminal Prompt Watcher Module
//!
//! Monitors PTY output streams and detects interactive prompts.
//! Publishes `TerminalPromptDetected` events to MessageBus for Orchestrator processing.

use std::{
    collections::HashMap,
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};

use tokio::{
    sync::{RwLock, broadcast::error::RecvError, oneshot},
    task::JoinHandle,
    time::Instant,
};

use crate::services::{
    orchestrator::{
        message_bus::SharedMessageBus,
        types::{PromptState, TerminalPromptEvent, TerminalPromptStateMachine},
    },
    terminal::{
        process::ProcessManager,
        prompt_detector::{DetectedPrompt, PromptDetector},
    },
};

// ============================================================================
// Constants
// ============================================================================

/// Minimum time between prompt detections for the same terminal (debounce)
const PROMPT_DEBOUNCE_MS: u64 = 500;

/// Timeout for prompt state machine to reset to idle
const PROMPT_STATE_TIMEOUT_SECS: i64 = 30;

/// Minimum confidence threshold for publishing prompt events
const MIN_CONFIDENCE_THRESHOLD: f32 = 0.7;

// ============================================================================
// Terminal Watch State
// ============================================================================

/// State for a single watched terminal
#[derive(Debug)]
struct TerminalWatchState {
    /// Terminal ID
    terminal_id: String,
    /// Workflow ID
    workflow_id: String,
    /// Task ID
    task_id: String,
    /// PTY session ID
    session_id: String,
    /// Whether auto-confirm is enabled for this terminal
    auto_confirm: bool,
    /// Prompt detector instance
    detector: PromptDetector,
    /// Prompt state machine
    state_machine: TerminalPromptStateMachine,
    /// Last detection timestamp (for debouncing)
    last_detection: Option<Instant>,
}

impl TerminalWatchState {
    fn new(
        terminal_id: String,
        workflow_id: String,
        task_id: String,
        session_id: String,
        auto_confirm: bool,
    ) -> Self {
        Self {
            terminal_id,
            workflow_id,
            task_id,
            session_id,
            auto_confirm,
            detector: PromptDetector::new(),
            state_machine: TerminalPromptStateMachine::new(),
            last_detection: None,
        }
    }

    /// Check if enough time has passed since last detection (debounce)
    fn should_debounce(&self) -> bool {
        if let Some(last) = self.last_detection {
            last.elapsed() < Duration::from_millis(PROMPT_DEBOUNCE_MS)
        } else {
            false
        }
    }

    /// Process a line of output and return detected prompt if any
    fn process_line(&mut self, line: &str) -> Option<DetectedPrompt> {
        // Check debounce
        if self.should_debounce() {
            return None;
        }

        // Detect prompt
        let prompt = self.detector.process_line(line)?;

        // Check confidence threshold
        if prompt.confidence < MIN_CONFIDENCE_THRESHOLD {
            return None;
        }

        // Check state machine
        if !self.state_machine.should_process(&prompt) {
            return None;
        }

        // Update state
        self.last_detection = Some(Instant::now());
        self.state_machine.on_prompt_detected(prompt.clone());

        Some(prompt)
    }

    /// Reset state machine if stale
    fn check_and_reset_stale(&mut self) {
        let timeout = chrono::Duration::seconds(PROMPT_STATE_TIMEOUT_SECS);
        if self.state_machine.is_stale(timeout) {
            self.state_machine.reset();
            self.detector.clear_buffer();
        }
    }
}

// ============================================================================
// Prompt Watcher
// ============================================================================

struct WatchTaskHandle {
    task_id: u64,
    task_handle: JoinHandle<()>,
}

/// Watches PTY output for interactive prompts and publishes events
#[derive(Clone)]
pub struct PromptWatcher {
    /// Message bus for publishing events
    message_bus: SharedMessageBus,
    /// Process manager for OutputFanout subscriptions
    process_manager: Arc<ProcessManager>,
    /// Watched terminals state
    terminals: Arc<RwLock<HashMap<String, TerminalWatchState>>>,
    /// Active background output subscriptions by terminal_id
    active_subscriptions: Arc<RwLock<HashMap<String, WatchTaskHandle>>>,
    /// Monotonic task ID for safe replacement/cleanup
    next_task_id: Arc<AtomicU64>,
}

impl PromptWatcher {
    /// Create a new prompt watcher
    pub fn new(message_bus: SharedMessageBus, process_manager: Arc<ProcessManager>) -> Self {
        Self {
            message_bus,
            process_manager,
            terminals: Arc::new(RwLock::new(HashMap::new())),
            active_subscriptions: Arc::new(RwLock::new(HashMap::new())),
            next_task_id: Arc::new(AtomicU64::new(1)),
        }
    }

    /// Register a terminal for watching
    pub async fn register(
        &self,
        terminal_id: &str,
        workflow_id: &str,
        task_id: &str,
        session_id: &str,
        auto_confirm: bool,
    ) -> anyhow::Result<()> {
        let state = TerminalWatchState::new(
            terminal_id.to_string(),
            workflow_id.to_string(),
            task_id.to_string(),
            session_id.to_string(),
            auto_confirm,
        );

        {
            let mut terminals = self.terminals.write().await;
            terminals.insert(terminal_id.to_string(), state);
        }
        if let Err(e) = self.spawn_output_subscription_task(terminal_id).await {
            let mut terminals = self.terminals.write().await;
            terminals.remove(terminal_id);
            return Err(e);
        }

        tracing::debug!(
            terminal_id = %terminal_id,
            workflow_id = %workflow_id,
            session_id = %session_id,
            auto_confirm,
            "Registered terminal for prompt watching"
        );
        Ok(())
    }

    /// Unregister a terminal from watching
    pub async fn unregister(&self, terminal_id: &str) {
        {
            let mut terminals = self.terminals.write().await;
            terminals.remove(terminal_id);
        }
        let task_handle = {
            let mut active_subscriptions = self.active_subscriptions.write().await;
            active_subscriptions
                .remove(terminal_id)
                .map(|handle| handle.task_handle)
        };
        if let Some(task_handle) = task_handle {
            task_handle.abort();
        }

        tracing::debug!(
            terminal_id = %terminal_id,
            "Unregistered terminal from prompt watching"
        );
    }

    async fn spawn_output_subscription_task(&self, terminal_id: &str) -> anyhow::Result<()> {
        let task_id = self.next_task_id.fetch_add(1, Ordering::Relaxed);
        let process_manager = Arc::clone(&self.process_manager);
        let watcher = self.clone();
        let active_subscriptions = Arc::clone(&self.active_subscriptions);
        let terminal_id_for_task = terminal_id.to_string();
        let (start_tx, start_rx) = oneshot::channel::<()>();
        let (ready_tx, ready_rx) = oneshot::channel::<anyhow::Result<()>>();

        let task_handle = tokio::spawn(async move {
            if start_rx.await.is_err() {
                return;
            }

            let mut subscription = match process_manager
                .subscribe_output(&terminal_id_for_task, None)
                .await
            {
                Ok(subscription) => {
                    let _ = ready_tx.send(Ok(()));
                    tracing::debug!(
                        terminal_id = %terminal_id_for_task,
                        "PromptWatcher subscribed to terminal output fanout"
                    );
                    subscription
                }
                Err(e) => {
                    let _ = ready_tx.send(Err(anyhow::anyhow!(
                        "PromptWatcher subscription failed: {e}"
                    )));
                    tracing::warn!(
                        terminal_id = %terminal_id_for_task,
                        error = %e,
                        "Failed to subscribe PromptWatcher to terminal output"
                    );
                    Self::remove_subscription_if_current(
                        &active_subscriptions,
                        &terminal_id_for_task,
                        task_id,
                    )
                    .await;
                    return;
                }
            };

            loop {
                match subscription.recv().await {
                    Ok(chunk) => {
                        if !chunk.text.is_empty() {
                            watcher
                                .process_output(&terminal_id_for_task, &chunk.text)
                                .await;
                        }
                        if chunk.dropped_invalid_bytes > 0 {
                            tracing::warn!(
                                terminal_id = %terminal_id_for_task,
                                seq = chunk.seq,
                                dropped_bytes = chunk.dropped_invalid_bytes,
                                "Dropped invalid UTF-8 bytes in prompt watcher stream"
                            );
                        }
                    }
                    Err(RecvError::Lagged(skipped)) => {
                        tracing::warn!(
                            terminal_id = %terminal_id_for_task,
                            skipped = %skipped,
                            "PromptWatcher output subscription lagged"
                        );
                    }
                    Err(RecvError::Closed) => {
                        break;
                    }
                }
            }

            Self::remove_subscription_if_current(
                &active_subscriptions,
                &terminal_id_for_task,
                task_id,
            )
            .await;
        });

        let replaced = {
            let mut active_subscriptions = self.active_subscriptions.write().await;
            active_subscriptions.insert(
                terminal_id.to_string(),
                WatchTaskHandle {
                    task_id,
                    task_handle,
                },
            )
        };
        if let Some(previous) = replaced {
            previous.task_handle.abort();
        }

        let _ = start_tx.send(());
        match tokio::time::timeout(Duration::from_secs(2), ready_rx).await {
            Ok(Ok(Ok(()))) => Ok(()),
            Ok(Ok(Err(e))) => Err(e),
            Ok(Err(_)) => Err(anyhow::anyhow!(
                "PromptWatcher startup acknowledgment channel closed"
            )),
            Err(_) => Err(anyhow::anyhow!(
                "Timed out waiting for PromptWatcher output subscription startup"
            )),
        }
    }

    async fn remove_subscription_if_current(
        active_subscriptions: &Arc<RwLock<HashMap<String, WatchTaskHandle>>>,
        terminal_id: &str,
        task_id: u64,
    ) {
        let mut active_subscriptions = active_subscriptions.write().await;
        let should_remove = matches!(
            active_subscriptions.get(terminal_id),
            Some(handle) if handle.task_id == task_id
        );
        if should_remove {
            active_subscriptions.remove(terminal_id);
        }
    }

    /// Process PTY output for a terminal
    ///
    /// Call this method with each line of PTY output.
    /// If a prompt is detected, publishes a `TerminalPromptDetected` event.
    pub async fn process_output(&self, terminal_id: &str, output: &str) {
        let mut terminals = self.terminals.write().await;

        let state = match terminals.get_mut(terminal_id) {
            Some(s) => s,
            None => {
                tracing::trace!(
                    terminal_id = %terminal_id,
                    "Terminal not registered for prompt watching, ignoring output"
                );
                return;
            }
        };

        // Check and reset stale state
        state.check_and_reset_stale();

        // Process each line
        for line in output.lines() {
            if let Some(prompt) = state.process_line(line) {
                let event = TerminalPromptEvent {
                    terminal_id: state.terminal_id.clone(),
                    workflow_id: state.workflow_id.clone(),
                    task_id: state.task_id.clone(),
                    session_id: state.session_id.clone(),
                    auto_confirm: state.auto_confirm,
                    prompt: prompt.clone(),
                    detected_at: chrono::Utc::now(),
                };

                tracing::info!(
                    terminal_id = %state.terminal_id,
                    prompt_kind = ?prompt.kind,
                    confidence = prompt.confidence,
                    has_dangerous_keywords = prompt.has_dangerous_keywords,
                    "Detected interactive prompt"
                );

                // Publish event (drop lock first to avoid deadlock)
                drop(terminals);
                self.message_bus
                    .publish_terminal_prompt_detected(event)
                    .await;
                return;
            }
        }
    }

    /// Update terminal state after response is sent
    pub async fn on_response_sent(
        &self,
        terminal_id: &str,
        decision: crate::services::orchestrator::types::PromptDecision,
    ) {
        let mut terminals = self.terminals.write().await;
        if let Some(state) = terminals.get_mut(terminal_id) {
            state.state_machine.on_response_sent(decision);
            state.detector.clear_buffer();
        }
    }

    /// Update terminal state when waiting for user approval
    pub async fn on_waiting_for_approval(
        &self,
        terminal_id: &str,
        decision: crate::services::orchestrator::types::PromptDecision,
    ) {
        let mut terminals = self.terminals.write().await;
        if let Some(state) = terminals.get_mut(terminal_id) {
            state.state_machine.on_waiting_for_approval(decision);
        }
    }

    /// Reset terminal prompt state
    pub async fn reset_state(&self, terminal_id: &str) {
        let mut terminals = self.terminals.write().await;
        if let Some(state) = terminals.get_mut(terminal_id) {
            state.state_machine.reset();
            state.detector.clear_buffer();
        }
    }

    /// Get current prompt state for a terminal
    pub async fn get_state(&self, terminal_id: &str) -> Option<PromptState> {
        let terminals = self.terminals.read().await;
        terminals.get(terminal_id).map(|s| s.state_machine.state)
    }

    /// Check if a terminal is registered
    pub async fn is_registered(&self, terminal_id: &str) -> bool {
        let terminals = self.terminals.read().await;
        let subscriptions = self.active_subscriptions.read().await;
        // Terminal is truly registered only if both state and active subscription exist
        terminals.contains_key(terminal_id) && subscriptions.contains_key(terminal_id)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::orchestrator::message_bus::{BusMessage, MessageBus};

    fn create_test_watcher() -> PromptWatcher {
        let message_bus = Arc::new(MessageBus::new(100));
        let process_manager = Arc::new(ProcessManager::new());
        PromptWatcher::new(message_bus, process_manager)
    }

    #[tokio::test]
    async fn test_register_unregister() {
        let watcher = create_test_watcher();

        // Registration will fail because no terminal exists in ProcessManager
        // This is expected in unit tests - we're testing state management, not integration
        let result = watcher
            .register("term-1", "workflow-1", "task-1", "session-1", true)
            .await;

        // Registration should fail with terminal not found
        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Terminal not found")
        );

        // Terminal should not be registered since subscription failed
        assert!(!watcher.is_registered("term-1").await);
    }

    #[tokio::test]
    async fn test_register_attempts_subscription_when_auto_confirm_disabled() {
        let watcher = create_test_watcher();

        let result = watcher
            .register("term-1", "workflow-1", "task-1", "session-1", false)
            .await;

        assert!(result.is_err());
        assert!(
            result
                .unwrap_err()
                .to_string()
                .contains("Terminal not found")
        );
        assert!(!watcher.is_registered("term-1").await);
    }

    #[tokio::test]
    async fn test_process_output_publishes_prompt_when_auto_confirm_disabled() {
        let message_bus = Arc::new(MessageBus::new(100));
        let process_manager = Arc::new(ProcessManager::new());
        let watcher = PromptWatcher::new(message_bus.clone(), process_manager);
        let mut broadcast_rx = message_bus.subscribe_broadcast();

        {
            let mut terminals = watcher.terminals.write().await;
            terminals.insert(
                "term-1".to_string(),
                TerminalWatchState::new(
                    "term-1".to_string(),
                    "workflow-1".to_string(),
                    "task-1".to_string(),
                    "session-1".to_string(),
                    false,
                ),
            );
        }

        watcher
            .process_output("term-1", "Press Enter to continue")
            .await;

        let event = tokio::time::timeout(Duration::from_millis(200), broadcast_rx.recv())
            .await
            .expect("expected prompt event broadcast")
            .expect("broadcast channel should be open");

        match event {
            BusMessage::TerminalPromptDetected(prompt_event) => {
                assert_eq!(prompt_event.terminal_id, "term-1");
                assert_eq!(prompt_event.workflow_id, "workflow-1");
                assert_eq!(prompt_event.task_id, "task-1");
                assert_eq!(prompt_event.session_id, "session-1");
                assert!(!prompt_event.auto_confirm);
            }
            other => panic!("expected TerminalPromptDetected event, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn test_process_output_unregistered() {
        let watcher = create_test_watcher();

        // Should not panic for unregistered terminal
        watcher
            .process_output("unknown-term", "Press Enter to continue")
            .await;
    }

    #[tokio::test]
    async fn test_get_state() {
        let watcher = create_test_watcher();

        // Unregistered terminal returns None
        assert!(watcher.get_state("term-1").await.is_none());
    }

    #[tokio::test]
    async fn test_reset_state() {
        let watcher = create_test_watcher();

        // Reset on unregistered terminal should not panic
        watcher.reset_state("term-1").await;
    }
}
