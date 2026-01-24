//! Orchestrator agent loop and event handling.

use std::sync::Arc;

use anyhow::anyhow;
use db::DBService;
use tokio::sync::RwLock;

use super::{
    config::OrchestratorConfig,
    constants::{
        TERMINAL_STATUS_COMPLETED, TERMINAL_STATUS_FAILED, TERMINAL_STATUS_REVIEW_PASSED,
        TERMINAL_STATUS_REVIEW_REJECTED, WORKFLOW_STATUS_COMPLETED, WORKFLOW_STATUS_FAILED,
        WORKFLOW_TOPIC_PREFIX,
    },
    llm::{LLMClient, build_terminal_completion_prompt, create_llm_client},
    message_bus::{BusMessage, SharedMessageBus},
    state::{OrchestratorRunState, OrchestratorState, SharedOrchestratorState},
    types::{OrchestratorInstruction, TerminalCompletionEvent, TerminalCompletionStatus},
};

/// Coordinates workflow execution, message handling, and LLM interactions.
pub struct OrchestratorAgent {
    config: OrchestratorConfig,
    state: SharedOrchestratorState,
    message_bus: SharedMessageBus,
    llm_client: Box<dyn LLMClient>,
    db: Arc<DBService>,
}

impl OrchestratorAgent {
    /// Builds a new orchestrator agent with a configured LLM client.
    pub fn new(
        config: OrchestratorConfig,
        workflow_id: String,
        message_bus: SharedMessageBus,
        db: Arc<DBService>,
    ) -> anyhow::Result<Self> {
        let llm_client = create_llm_client(&config)?;
        let state = Arc::new(RwLock::new(OrchestratorState::new(workflow_id)));

        Ok(Self {
            config,
            state,
            message_bus,
            llm_client,
            db,
        })
    }

    /// Create a new agent with a custom LLM client (for testing)
    #[cfg(test)]
    pub fn with_llm_client(
        config: OrchestratorConfig,
        workflow_id: String,
        message_bus: SharedMessageBus,
        db: Arc<DBService>,
        llm_client: Box<dyn LLMClient>,
    ) -> anyhow::Result<Self> {
        let state = Arc::new(RwLock::new(OrchestratorState::new(workflow_id)));

        Ok(Self {
            config,
            state,
            message_bus,
            llm_client,
            db,
        })
    }

    /// Runs the orchestrator event loop until shutdown.
    pub async fn run(&self) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        let mut rx = self
            .message_bus
            .subscribe(&format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}"))
            .await;
        tracing::info!("Orchestrator started for workflow: {}", workflow_id);

        // 初始化系统消息
        {
            let mut state = self.state.write().await;
            state.add_message("system", &self.config.system_prompt, &self.config);
            state.run_state = OrchestratorRunState::Idle;
        }

        // 事件循环
        while let Some(message) = rx.recv().await {
            let should_stop = self.handle_message(message).await?;
            if should_stop {
                break;
            }
        }

        tracing::info!("Orchestrator stopped for workflow: {}", workflow_id);
        Ok(())
    }

    /// Dispatches incoming bus messages and returns true if shutdown is requested.
    async fn handle_message(&self, message: BusMessage) -> anyhow::Result<bool> {
        match message {
            BusMessage::TerminalCompleted(event) => {
                self.handle_terminal_completed(event).await?;
            }
            BusMessage::GitEvent {
                workflow_id,
                commit_hash,
                branch,
                message,
            } => {
                self.handle_git_event(&workflow_id, &commit_hash, &branch, &message)
                    .await?;
            }
            BusMessage::Shutdown => {
                return Ok(true);
            }
            _ => {}
        }
        Ok(false)
    }

    /// Handles terminal completion events.
    async fn handle_terminal_completed(
        &self,
        event: TerminalCompletionEvent,
    ) -> anyhow::Result<()> {
        tracing::info!(
            "Terminal completed: {} with status {:?}",
            event.terminal_id,
            event.status
        );

        // 更新状态
        {
            let mut state = self.state.write().await;
            state.run_state = OrchestratorRunState::Processing;
            let success = matches!(
                event.status,
                TerminalCompletionStatus::Completed | TerminalCompletionStatus::ReviewPass
            );
            state.mark_terminal_completed(&event.task_id, &event.terminal_id, success);
        }

        // 构建提示并调用 LLM
        let prompt = Self::build_completion_prompt(&event);
        let response = self.call_llm(&prompt).await?;

        // 解析并执行指令
        self.execute_instruction(&response).await?;

        // 恢复空闲状态
        {
            let mut state = self.state.write().await;
            state.run_state = OrchestratorRunState::Idle;
        }

        Ok(())
    }

    /// Handles Git events emitted by the watcher.
    pub async fn handle_git_event(
        &self,
        workflow_id: &str,
        commit_hash: &str,
        branch: &str,
        message: &str,
    ) -> anyhow::Result<()> {
        tracing::info!(
            "Git event: {} on branch {} - {}",
            commit_hash, branch, message
        );

        // 1. Parse commit metadata
        let metadata = crate::services::git_watcher::parse_commit_metadata(message)?;

        // 2. Validate workflow_id matches
        if metadata.workflow_id != workflow_id {
            tracing::warn!(
                "Workflow ID mismatch: expected {}, got {}",
                workflow_id, metadata.workflow_id
            );
            return Ok(());
        }

        // 3. Route to handler based on status
        match metadata.status.as_str() {
            TERMINAL_STATUS_COMPLETED => {
                self.handle_git_terminal_completed(
                    &metadata.terminal_id,
                    &metadata.task_id,
                    commit_hash,
                    message,
                ).await?;
            }
            "review_pass" => {
                self.handle_git_review_pass(
                    &metadata.terminal_id,
                    &metadata.task_id,
                    &metadata.reviewed_terminal.ok_or_else(|| anyhow!("reviewed_terminal required for review_pass"))?,
                ).await?;
            }
            "review_reject" => {
                self.handle_git_review_reject(
                    &metadata.terminal_id,
                    &metadata.task_id,
                    &metadata.reviewed_terminal.ok_or_else(|| anyhow!("reviewed_terminal required for review_reject"))?,
                    &metadata.issues.ok_or_else(|| anyhow!("issues required for review_reject"))?,
                ).await?;
            }
            TERMINAL_STATUS_FAILED => {
                self.handle_git_terminal_failed(
                    &metadata.terminal_id,
                    &metadata.task_id,
                    message,
                ).await?;
            }
            _ => {
                tracing::warn!("Unknown status in commit: {}", metadata.status);
            }
        }

        Ok(())
    }

    /// Handle terminal completed status from git event
    async fn handle_git_terminal_completed(
        &self,
        terminal_id: &str,
        task_id: &str,
        commit_hash: &str,
        commit_message: &str,
    ) -> anyhow::Result<()> {
        tracing::info!(
            "Terminal {} completed task {} (commit: {})",
            terminal_id, task_id, commit_hash
        );

        // 1. Update terminal status
        db::models::Terminal::update_status(
            &self.db.pool,
            terminal_id,
            TERMINAL_STATUS_COMPLETED
        ).await?;

        // 2. Publish completion event
        let workflow_id = self.state.read().await.workflow_id.clone();
        let event = BusMessage::TerminalCompleted(TerminalCompletionEvent {
            terminal_id: terminal_id.to_string(),
            task_id: task_id.to_string(),
            workflow_id: workflow_id.clone(),
            status: TerminalCompletionStatus::Completed,
            commit_hash: Some(commit_hash.to_string()),
            commit_message: Some(commit_message.to_string()),
            metadata: None,
        });

        self.message_bus
            .publish(&format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}"), event)
            .await?;

        // 3. Awaken orchestrator to process the event
        self.awaken().await;

        Ok(())
    }

    /// Handle review passed status from git event
    async fn handle_git_review_pass(
        &self,
        reviewer_terminal_id: &str,
        _task_id: &str,
        reviewed_terminal_id: &str,
    ) -> anyhow::Result<()> {
        tracing::info!(
            "Terminal {} approved work from {}",
            reviewer_terminal_id, reviewed_terminal_id
        );

        // 1. Update reviewed terminal status
        db::models::Terminal::update_status(
            &self.db.pool,
            reviewed_terminal_id,
            TERMINAL_STATUS_REVIEW_PASSED
        ).await?;

        // 2. Publish review passed event
        let workflow_id = self.state.read().await.workflow_id.clone();
        let event = BusMessage::StatusUpdate {
            workflow_id: workflow_id.clone(),
            status: TERMINAL_STATUS_REVIEW_PASSED.to_string(),
        };

        self.message_bus
            .publish(&format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}"), event)
            .await?;

        // 3. Awaken orchestrator to process the event
        self.awaken().await;

        Ok(())
    }

    /// Handle review rejected status from git event
    async fn handle_git_review_reject(
        &self,
        reviewer_terminal_id: &str,
        _task_id: &str,
        reviewed_terminal_id: &str,
        issues: &[crate::services::git_watcher::Issue],
    ) -> anyhow::Result<()> {
        tracing::warn!(
            "Terminal {} rejected work from {}: {} issues found",
            reviewer_terminal_id, reviewed_terminal_id, issues.len()
        );

        // 1. Update reviewed terminal status
        db::models::Terminal::update_status(
            &self.db.pool,
            reviewed_terminal_id,
            TERMINAL_STATUS_REVIEW_REJECTED
        ).await?;

        // 2. Publish review rejected event
        let workflow_id = self.state.read().await.workflow_id.clone();
        let event = BusMessage::StatusUpdate {
            workflow_id: workflow_id.clone(),
            status: TERMINAL_STATUS_REVIEW_REJECTED.to_string(),
        };

        self.message_bus
            .publish(&format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}"), event)
            .await?;

        // 3. Awaken orchestrator to process the event
        self.awaken().await;

        Ok(())
    }

    /// Handle terminal failed status from git event
    async fn handle_git_terminal_failed(
        &self,
        terminal_id: &str,
        task_id: &str,
        error_message: &str,
    ) -> anyhow::Result<()> {
        tracing::error!(
            "Terminal {} failed task {}: {}",
            terminal_id, task_id, error_message
        );

        // 1. Update terminal status
        db::models::Terminal::update_status(
            &self.db.pool,
            terminal_id,
            TERMINAL_STATUS_FAILED
        ).await?;

        // 2. Publish failure event
        let workflow_id = self.state.read().await.workflow_id.clone();
        let event = BusMessage::Error {
            workflow_id: workflow_id.clone(),
            error: error_message.to_string(),
        };

        self.message_bus
            .publish(&format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}"), event)
            .await?;

        // 3. Awaken orchestrator to process the event
        self.awaken().await;

        Ok(())
    }

    /// Awaken the orchestrator to process events
    async fn awaken(&self) {
        // Check if orchestrator is idle and needs to be awakened
        let state = self.state.read().await;
        if state.run_state == OrchestratorRunState::Idle {
            tracing::debug!("Orchestrator is idle, ensuring it processes pending events");
            // Drop the read lock before we potentially do anything else
            drop(state);
        }
        // The orchestrator's event loop will automatically process
        // any messages we published to the message bus
    }

    /// Builds the prompt for a terminal completion event.
    fn build_completion_prompt(event: &TerminalCompletionEvent) -> String {
        let commit_hash = event.commit_hash.as_deref().unwrap_or("N/A");
        let commit_message = event.commit_message.as_deref().unwrap_or("No message");

        build_terminal_completion_prompt(
            &event.terminal_id,
            &event.task_id,
            commit_hash,
            commit_message,
        )
    }

    /// Calls the LLM with the current conversation history.
    async fn call_llm(&self, prompt: &str) -> anyhow::Result<String> {
        let mut state = self.state.write().await;
        state.add_message("user", prompt, &self.config);

        let messages = state.conversation_history.clone();
        drop(state);

        let response = self.llm_client.chat(messages).await?;

        let mut state = self.state.write().await;
        state.add_message("assistant", &response.content, &self.config);
        if let Some(usage) = &response.usage {
            state.total_tokens_used += i64::from(usage.total_tokens);
        }

        Ok(response.content)
    }

    /// Executes orchestrator instructions returned by the LLM.
    pub async fn execute_instruction(&self, response: &str) -> anyhow::Result<()> {
        // 尝试解析 JSON 指令
        if let Ok(instruction) = serde_json::from_str::<OrchestratorInstruction>(response) {
            match instruction {
                OrchestratorInstruction::SendToTerminal {
                    terminal_id,
                    message,
                } => {
                    tracing::info!("Sending to terminal {}: {}", terminal_id, message);

                    // 1. Get terminal from database
                    let terminal =
                        db::models::Terminal::find_by_id(&self.db.pool, &terminal_id)
                            .await
                            .map_err(|e| anyhow::anyhow!("Failed to get terminal: {e}"))?
                            .ok_or_else(|| anyhow::anyhow!("Terminal {terminal_id} not found"))?;

                    // 2. Get PTY session ID
                    let pty_session_id = terminal.pty_session_id.ok_or_else(|| {
                        anyhow::anyhow!("Terminal {terminal_id} has no PTY session")
                    })?;

                    // 3. Send message via message bus
                    self.message_bus
                        .publish(&pty_session_id, BusMessage::TerminalMessage { message })
                        .await
                        .map_err(|e| anyhow::anyhow!("Failed to send message: {e}"))?;

                    tracing::debug!("Message sent to terminal {}", terminal_id);
                }
                OrchestratorInstruction::CompleteWorkflow { summary } => {
                    tracing::info!("Completing workflow: {}", summary);

                    // Get workflow ID from state
                    let workflow_id = {
                        let state = self.state.read().await;
                        state.workflow_id.clone()
                    };

                    // Update workflow status to completed
                    db::models::Workflow::update_status(
                        &self.db.pool,
                        &workflow_id,
                        WORKFLOW_STATUS_COMPLETED
                    )
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to update workflow status: {e}"))?;

                    // Publish completion event
                    self.message_bus.publish(
                        &format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}"),
                        BusMessage::StatusUpdate {
                            workflow_id: workflow_id.clone(),
                            status: WORKFLOW_STATUS_COMPLETED.to_string(),
                        }
                    )
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to publish completion event: {e}"))?;

                    // Transition to Idle
                    self.state.write().await.run_state = OrchestratorRunState::Idle;

                    tracing::info!("Workflow {} completed successfully", workflow_id);
                }
                OrchestratorInstruction::FailWorkflow { reason } => {
                    tracing::error!("Failing workflow: {}", reason);

                    // Get workflow ID from state
                    let workflow_id = {
                        let state = self.state.read().await;
                        state.workflow_id.clone()
                    };

                    // Update workflow status to failed
                    db::models::Workflow::update_status(
                        &self.db.pool,
                        &workflow_id,
                        WORKFLOW_STATUS_FAILED
                    )
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to update workflow status: {e}"))?;

                    // Publish failure event
                    self.message_bus.publish(
                        &format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}"),
                        BusMessage::Error {
                            workflow_id: workflow_id.clone(),
                            error: reason.clone(),
                        }
                    )
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to publish failure event: {e}"))?;

                    // Transition to Idle
                    self.state.write().await.run_state = OrchestratorRunState::Idle;

                    tracing::error!("Workflow {} failed: {}", workflow_id, reason);
                }
                _ => {}
            }
        }
        Ok(())
    }

    /// Broadcast workflow status update
    ///
    /// Updates the workflow status in the database and broadcasts
    /// a StatusUpdate message to the workflow's message bus topic.
    pub async fn broadcast_workflow_status(&self, status: &str) -> anyhow::Result<()> {
        // 1. Get workflow_id
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // 2. Update database (synchronously await result)
        db::models::Workflow::update_status(
            &self.db.pool,
            &workflow_id,
            status,
        ).await?;

        // 3. Publish to message bus (synchronously await result)
        let message = BusMessage::StatusUpdate {
            workflow_id: workflow_id.clone(),
            status: status.to_string(),
        };
        let topic = format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}");
        self.message_bus.publish(&topic, message).await?;

        tracing::debug!(
            "Broadcast workflow status: {} -> {}",
            workflow_id,
            status
        );

        Ok(())
    }

    /// Broadcast terminal status update
    ///
    /// Updates the terminal status in the database and broadcasts
    /// a TerminalStatusUpdate message to the workflow's message bus topic.
    pub async fn broadcast_terminal_status(&self, terminal_id: &str, status: &str) -> anyhow::Result<()> {
        // 1. Get workflow_id
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // 2. Update database (synchronously await result)
        db::models::Terminal::update_status(
            &self.db.pool,
            terminal_id,
            status,
        ).await?;

        // 3. Publish to message bus (synchronously await result)
        let message = BusMessage::TerminalStatusUpdate {
            workflow_id: workflow_id.clone(),
            terminal_id: terminal_id.to_string(),
            status: status.to_string(),
        };
        let topic = format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}");
        self.message_bus.publish(&topic, message).await?;

        tracing::debug!(
            "Broadcast terminal status: {} -> {}",
            terminal_id,
            status
        );

        Ok(())
    }

    /// Broadcast task status update
    ///
    /// Updates the task status in the database and broadcasts
    /// a TaskStatusUpdate message to the workflow's message bus topic.
    pub async fn broadcast_task_status(&self, task_id: &str, status: &str) -> anyhow::Result<()> {
        // 1. Get workflow_id
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // 2. Update database (synchronously await result)
        db::models::WorkflowTask::update_status(
            &self.db.pool,
            task_id,
            status,
        ).await?;

        // 3. Publish to message bus (synchronously await result)
        let message = BusMessage::TaskStatusUpdate {
            workflow_id: workflow_id.clone(),
            task_id: task_id.to_string(),
            status: status.to_string(),
        };
        let topic = format!("{WORKFLOW_TOPIC_PREFIX}{workflow_id}");
        self.message_bus.publish(&topic, message).await?;

        tracing::debug!(
            "Broadcast task status: {} -> {}",
            task_id,
            status
        );

        Ok(())
    }
}
