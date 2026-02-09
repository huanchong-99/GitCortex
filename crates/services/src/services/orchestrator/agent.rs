//! Orchestrator agent loop and event handling.

use std::{collections::HashMap, sync::Arc};

use anyhow::anyhow;
use db::DBService;
use tokio::sync::RwLock;

use super::{
    config::OrchestratorConfig,
    constants::{
        GIT_COMMIT_METADATA_SEPARATOR,
        TERMINAL_STATUS_COMPLETED, TERMINAL_STATUS_FAILED, TERMINAL_STATUS_REVIEW_PASSED,
        TERMINAL_STATUS_REVIEW_REJECTED, WORKFLOW_STATUS_COMPLETED, WORKFLOW_STATUS_FAILED,
        WORKFLOW_STATUS_MERGING, WORKFLOW_TOPIC_PREFIX,
    },
    llm::{LLMClient, build_terminal_completion_prompt, create_llm_client},
    message_bus::{BusMessage, SharedMessageBus},
    prompt_handler::PromptHandler,
    state::{OrchestratorRunState, OrchestratorState, SharedOrchestratorState},
    types::{
        CodeIssue, OrchestratorInstruction, TerminalCompletionEvent, TerminalCompletionStatus,
        TerminalPromptEvent,
    },
};
use crate::services::{
    error_handler::ErrorHandler,
    template_renderer::{TemplateRenderer, WorkflowContext},
};

/// Coordinates workflow execution, message handling, and LLM interactions.
pub struct OrchestratorAgent {
    config: OrchestratorConfig,
    state: SharedOrchestratorState,
    message_bus: SharedMessageBus,
    llm_client: Box<dyn LLMClient>,
    db: Arc<DBService>,
    error_handler: ErrorHandler,
    prompt_handler: PromptHandler,
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
        let error_handler = ErrorHandler::new(db.clone(), message_bus.clone());
        let prompt_handler = PromptHandler::new(message_bus.clone());

        Ok(Self {
            config,
            state,
            message_bus,
            llm_client,
            db,
            error_handler,
            prompt_handler,
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
        let error_handler = ErrorHandler::new(db.clone(), message_bus.clone());
        let prompt_handler = PromptHandler::new(message_bus.clone());

        Ok(Self {
            config,
            state,
            message_bus,
            llm_client,
            db,
            error_handler,
            prompt_handler,
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

        // Execute slash commands if enabled for this workflow
        if let Err(e) = self.execute_slash_commands().await {
            tracing::error!("Failed to execute slash commands: {}", e);
            // Don't fail the workflow, just log the error
        }

        // Auto-dispatch initial terminals for all tasks
        if let Err(e) = self.auto_dispatch_initial_tasks().await {
            tracing::error!("Failed to auto-dispatch initial tasks: {}", e);
            // Don't fail the workflow, just log the error
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
            BusMessage::TerminalPromptDetected(event) => {
                self.handle_terminal_prompt_detected(event).await?;
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

    /// Handles terminal prompt detected events.
    async fn handle_terminal_prompt_detected(
        &self,
        event: TerminalPromptEvent,
    ) -> anyhow::Result<()> {
        if let Some(decision) = self.prompt_handler.handle_prompt_event(&event).await {
            tracing::info!(
                terminal_id = %event.terminal_id,
                prompt_kind = ?event.prompt.kind,
                decision = ?decision,
                "Handled terminal prompt event"
            );
        }
        Ok(())
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

        // Determine if terminal completed successfully
        let success = matches!(
            event.status,
            TerminalCompletionStatus::Completed | TerminalCompletionStatus::ReviewPass
        );

        // Update state and get next terminal info
        let (next_terminal_index, task_completed, has_next, task_failed) = {
            let mut state = self.state.write().await;
            state.run_state = OrchestratorRunState::Processing;
            state.mark_terminal_completed(&event.task_id, &event.terminal_id, success);

            // Advance to next terminal if successful
            let has_next = if success {
                state.advance_terminal(&event.task_id)
            } else {
                false
            };

            let next_index = state.get_next_terminal_for_task(&event.task_id);
            let task_completed = state.is_task_completed(&event.task_id);
            let task_failed = state.task_has_failures(&event.task_id);

            (next_index, task_completed, has_next, task_failed)
        };

        // Update task status based on completion/failure
        // Fail fast: if terminal failed, mark task as failed immediately to avoid stalled tasks
        if !success {
            // Terminal failed - mark task as failed immediately
            if let Err(e) =
                db::models::WorkflowTask::update_status(&self.db.pool, &event.task_id, "failed")
                    .await
            {
                tracing::error!("Failed to mark task {} failed: {}", event.task_id, e);
            }
            tracing::warn!(
                "Task {} marked as failed due to terminal {} failure",
                event.task_id,
                event.terminal_id
            );
        } else if task_failed && task_completed {
            // Task has failures and all terminals are done - mark as failed
            if let Err(e) =
                db::models::WorkflowTask::update_status(&self.db.pool, &event.task_id, "failed")
                    .await
            {
                tracing::error!("Failed to mark task {} failed: {}", event.task_id, e);
            }
        } else if task_completed {
            // Task completed successfully
            if let Err(e) =
                db::models::WorkflowTask::update_status(&self.db.pool, &event.task_id, "completed")
                    .await
            {
                tracing::error!("Failed to mark task {} completed: {}", event.task_id, e);
            }
        }

        // 构建提示并调用 LLM
        let prompt = Self::build_completion_prompt(&event);
        let response = self.call_llm(&prompt).await?;

        // 解析并执行指令
        self.execute_instruction(&response).await?;

        // Auto-dispatch next terminal if successful, there's more to do, and task hasn't failed
        if success && has_next && !task_failed {
            if let Some(index) = next_terminal_index {
                if let Err(e) = self.dispatch_next_terminal(&event.task_id, index).await {
                    tracing::error!(
                        "Failed to dispatch next terminal for task {}: {}",
                        event.task_id,
                        e
                    );
                }
            }
        }

        // 恢复空闲状态
        {
            let mut state = self.state.write().await;
            state.run_state = OrchestratorRunState::Idle;
        }

        Ok(())
    }

    /// Dispatches the next terminal in a task sequence.
    async fn dispatch_next_terminal(
        &self,
        task_id: &str,
        terminal_index: usize,
    ) -> anyhow::Result<()> {
        // Get task
        let task = db::models::WorkflowTask::find_by_id(&self.db.pool, task_id)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get task: {e}"))?
            .ok_or_else(|| anyhow::anyhow!("Task {task_id} not found"))?;

        // Get terminals
        let terminals = db::models::Terminal::find_by_task(&self.db.pool, task_id)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get terminals: {e}"))?;

        let terminal = terminals.get(terminal_index).cloned().ok_or_else(|| {
            anyhow::anyhow!("Terminal index {terminal_index} out of range for task {task_id}")
        })?;

        // Only dispatch if terminal is in waiting status
        if terminal.status != "waiting" {
            tracing::debug!(
                "Skipping next terminal {} due to status {}",
                terminal.id,
                terminal.status
            );
            return Ok(());
        }

        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // Build and dispatch instruction
        let instruction =
            Self::build_task_instruction(&workflow_id, &task, &terminal, terminals.len());
        self.dispatch_terminal(task_id, &terminal, &instruction)
            .await
    }

    /// Handles Git events emitted by the watcher.
    ///
    /// For commits with METADATA: routes to appropriate handler based on status.
    /// For commits without METADATA: wakes up orchestrator for decision making.
    pub async fn handle_git_event(
        &self,
        workflow_id: &str,
        commit_hash: &str,
        branch: &str,
        message: &str,
    ) -> anyhow::Result<()> {
        tracing::info!(
            "Git event: {} on branch {} - {}",
            commit_hash,
            branch,
            message
        );

        // Check if this commit was already processed (idempotency)
        {
            let state = self.state.read().await;
            if state.processed_commits.contains(commit_hash) {
                tracing::debug!("Commit {} already processed, skipping", commit_hash);
                return Ok(());
            }
        }

        // 1. Try to parse commit metadata
        let metadata = match crate::services::git_watcher::parse_commit_metadata(message) {
            Ok(m) => m,
            Err(_) => {
                // No METADATA - wake up orchestrator for decision
                tracing::info!(
                    "Commit {} has no METADATA, waking orchestrator for decision",
                    commit_hash
                );
                // Mark commit as processed to avoid repeated wake-ups
                {
                    let mut state = self.state.write().await;
                    state.processed_commits.insert(commit_hash.to_string());
                }
                self.handle_git_event_no_metadata(workflow_id, commit_hash, branch, message)
                    .await?;
                return Ok(());
            }
        };

        // 2. Validate workflow_id matches
        if metadata.workflow_id != workflow_id {
            tracing::warn!(
                "Workflow ID mismatch: expected {}, got {}",
                workflow_id,
                metadata.workflow_id
            );
            // Don't mark as processed - another workflow may need this commit
            return Ok(());
        }

        // Mark commit as processed after validation
        {
            let mut state = self.state.write().await;
            state.processed_commits.insert(commit_hash.to_string());
        }

        // 3. Route to handler based on status
        match metadata.status.as_str() {
            TERMINAL_STATUS_COMPLETED => {
                self.handle_git_terminal_completed(
                    &metadata.terminal_id,
                    &metadata.task_id,
                    commit_hash,
                    message,
                )
                .await?;
            }
            "review_pass" => {
                self.handle_git_review_pass(
                    &metadata.terminal_id,
                    &metadata.task_id,
                    &metadata
                        .reviewed_terminal
                        .ok_or_else(|| anyhow!("reviewed_terminal required for review_pass"))?,
                )
                .await?;
            }
            "review_reject" => {
                self.handle_git_review_reject(
                    &metadata.terminal_id,
                    &metadata.task_id,
                    &metadata
                        .reviewed_terminal
                        .ok_or_else(|| anyhow!("reviewed_terminal required for review_reject"))?,
                    &metadata
                        .issues
                        .ok_or_else(|| anyhow!("issues required for review_reject"))?,
                )
                .await?;
            }
            TERMINAL_STATUS_FAILED => {
                self.handle_git_terminal_failed(&metadata.terminal_id, &metadata.task_id, message)
                    .await?;
            }
            _ => {
                tracing::warn!("Unknown status in commit: {}", metadata.status);
            }
        }

        Ok(())
    }

    /// Handle git event without METADATA - wake up orchestrator for decision.
    async fn handle_git_event_no_metadata(
        &self,
        workflow_id: &str,
        commit_hash: &str,
        branch: &str,
        message: &str,
    ) -> anyhow::Result<()> {
        // Add to conversation history for context
        {
            let mut state = self.state.write().await;
            state.add_message(
                "system",
                &format!(
                    "Git commit detected on branch '{}': {} - {}",
                    branch,
                    &commit_hash[..8.min(commit_hash.len())],
                    message
                ),
                &self.config,
            );
        }

        // Wake up orchestrator to decide next action
        self.awaken().await;

        tracing::info!(
            "Orchestrator awakened for commit {} on workflow {}",
            commit_hash,
            workflow_id
        );

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
            terminal_id,
            task_id,
            commit_hash
        );

        // 1. Update terminal status
        db::models::Terminal::update_status(&self.db.pool, terminal_id, TERMINAL_STATUS_COMPLETED)
            .await?;

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
            .publish_workflow_event(&workflow_id, event)
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
            reviewer_terminal_id,
            reviewed_terminal_id
        );

        // 1. Update reviewed terminal status
        db::models::Terminal::update_status(
            &self.db.pool,
            reviewed_terminal_id,
            TERMINAL_STATUS_REVIEW_PASSED,
        )
        .await?;

        // 2. Publish review passed event
        let workflow_id = self.state.read().await.workflow_id.clone();
        let event = BusMessage::TerminalStatusUpdate {
            workflow_id: workflow_id.clone(),
            terminal_id: reviewed_terminal_id.to_string(),
            status: TERMINAL_STATUS_REVIEW_PASSED.to_string(),
        };

        self.message_bus
            .publish_workflow_event(&workflow_id, event)
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
        issues: &[CodeIssue],
    ) -> anyhow::Result<()> {
        tracing::warn!(
            "Terminal {} rejected work from {}: {} issues found",
            reviewer_terminal_id,
            reviewed_terminal_id,
            issues.len()
        );

        // 1. Update reviewed terminal status
        db::models::Terminal::update_status(
            &self.db.pool,
            reviewed_terminal_id,
            TERMINAL_STATUS_REVIEW_REJECTED,
        )
        .await?;

        // 2. Publish review rejected event
        let workflow_id = self.state.read().await.workflow_id.clone();
        let event = BusMessage::TerminalStatusUpdate {
            workflow_id: workflow_id.clone(),
            terminal_id: reviewed_terminal_id.to_string(),
            status: TERMINAL_STATUS_REVIEW_REJECTED.to_string(),
        };

        self.message_bus
            .publish_workflow_event(&workflow_id, event)
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
            terminal_id,
            task_id,
            error_message
        );

        // 1. Update terminal status
        db::models::Terminal::update_status(&self.db.pool, terminal_id, TERMINAL_STATUS_FAILED)
            .await?;

        // 2. Publish failure event
        let workflow_id = self.state.read().await.workflow_id.clone();
        let event = BusMessage::Error {
            workflow_id: workflow_id.clone(),
            error: error_message.to_string(),
        };

        self.message_bus
            .publish_workflow_event(&workflow_id, event)
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
                    let terminal = db::models::Terminal::find_by_id(&self.db.pool, &terminal_id)
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
                        WORKFLOW_STATUS_COMPLETED,
                    )
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to update workflow status: {e}"))?;

                    // Publish completion event
                    self.message_bus
                        .publish_workflow_event(
                            &workflow_id,
                            BusMessage::StatusUpdate {
                                workflow_id: workflow_id.clone(),
                                status: WORKFLOW_STATUS_COMPLETED.to_string(),
                            },
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
                        WORKFLOW_STATUS_FAILED,
                    )
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to update workflow status: {e}"))?;

                    // Publish failure event
                    self.message_bus
                        .publish_workflow_event(
                            &workflow_id,
                            BusMessage::Error {
                                workflow_id: workflow_id.clone(),
                                error: reason.clone(),
                            },
                        )
                        .await
                        .map_err(|e| anyhow::anyhow!("Failed to publish failure event: {e}"))?;

                    // Transition to Idle
                    self.state.write().await.run_state = OrchestratorRunState::Idle;

                    tracing::error!("Workflow {} failed: {}", workflow_id, reason);
                }
                OrchestratorInstruction::StartTask {
                    task_id,
                    instruction,
                } => {
                    tracing::info!("Starting task {}: {}", task_id, instruction);

                    // 1. Get task from database
                    let task = db::models::WorkflowTask::find_by_id(&self.db.pool, &task_id)
                        .await
                        .map_err(|e| anyhow::anyhow!("Failed to get task: {e}"))?
                        .ok_or_else(|| anyhow::anyhow!("Task {task_id} not found"))?;

                    // 2. Get terminals for this task
                    let terminals = db::models::Terminal::find_by_task(&self.db.pool, &task_id)
                        .await
                        .map_err(|e| anyhow::anyhow!("Failed to get terminals: {e}"))?;

                    if terminals.is_empty() {
                        return Err(anyhow::anyhow!("No terminals found for task {task_id}"));
                    }

                    // 3. Initialize task state if not already done
                    {
                        let mut state = self.state.write().await;
                        if !state.task_states.contains_key(&task_id) {
                            state.init_task(task_id.clone(), terminals.len());
                        }
                    }

                    // 4. Get next terminal index
                    let next_index = {
                        let state = self.state.read().await;
                        state.get_next_terminal_for_task(&task_id)
                    };

                    // 5. Dispatch the terminal
                    if let Some(index) = next_index {
                        let terminal = terminals.get(index).cloned().ok_or_else(|| {
                            anyhow::anyhow!(
                                "Terminal index {index} out of range for task {task_id}"
                            )
                        })?;
                        self.dispatch_terminal(&task.id, &terminal, &instruction)
                            .await?;
                    } else {
                        tracing::info!("No pending terminals for task {task_id}");
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }

    /// Dispatches a terminal with the given instruction.
    ///
    /// Updates terminal and task status, then sends the instruction to the PTY session.
    /// If the terminal has no PTY session, marks both terminal and task as failed.
    /// Skips dispatch if terminal is not in "waiting" status.
    async fn dispatch_terminal(
        &self,
        task_id: &str,
        terminal: &db::models::Terminal,
        instruction: &str,
    ) -> anyhow::Result<()> {
        // 0. Check terminal status - only dispatch if waiting
        if terminal.status != "waiting" {
            tracing::warn!(
                "Skipping dispatch for terminal {} due to status {}",
                terminal.id,
                terminal.status
            );
            return Ok(());
        }

        // 1. Get PTY session ID, fail if not available
        let pty_session_id = match terminal.pty_session_id.as_deref() {
            Some(id) => id.to_string(),
            None => {
                let error_msg = format!(
                    "Terminal {} has no PTY session, marking as failed",
                    terminal.id
                );
                tracing::error!("{}", error_msg);

                // Get workflow_id for broadcasting
                let workflow_id = {
                    let state = self.state.read().await;
                    state.workflow_id.clone()
                };

                // Mark terminal as failed
                let _ = db::models::Terminal::update_status(
                    &self.db.pool,
                    &terminal.id,
                    TERMINAL_STATUS_FAILED,
                )
                .await;

                // Broadcast terminal status update
                let _ = self
                    .message_bus
                    .publish_workflow_event(
                        &workflow_id,
                        BusMessage::TerminalStatusUpdate {
                            workflow_id: workflow_id.clone(),
                            terminal_id: terminal.id.clone(),
                            status: TERMINAL_STATUS_FAILED.to_string(),
                        },
                    )
                    .await;

                // Mark task as failed
                let _ =
                    db::models::WorkflowTask::update_status(&self.db.pool, task_id, "failed").await;

                // Broadcast task status update
                let _ = self
                    .message_bus
                    .publish_workflow_event(
                        &workflow_id,
                        BusMessage::TaskStatusUpdate {
                            workflow_id: workflow_id.clone(),
                            task_id: task_id.to_string(),
                            status: "failed".to_string(),
                        },
                    )
                    .await;

                // Broadcast error event for UI notification
                let _ = self
                    .message_bus
                    .publish_workflow_event(
                        &workflow_id,
                        BusMessage::Error {
                            workflow_id: workflow_id.clone(),
                            error: error_msg.clone(),
                        },
                    )
                    .await;

                return Err(anyhow::anyhow!(
                    "Terminal {} has no PTY session",
                    terminal.id
                ));
            }
        };

        // 2. Update terminal status to working
        db::models::Terminal::update_status(&self.db.pool, &terminal.id, "working")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to update terminal status: {e}"))?;

        // 3. Update task status to running
        db::models::WorkflowTask::update_status(&self.db.pool, task_id, "running")
            .await
            .map_err(|e| anyhow::anyhow!("Failed to update task status: {e}"))?;

        // 4. Send instruction to PTY session
        self.message_bus
            .publish(
                &pty_session_id,
                BusMessage::TerminalMessage {
                    message: instruction.to_string(),
                },
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send instruction to terminal: {e}"))?;

        tracing::info!(
            "Dispatched terminal {} for task {} with instruction: {}",
            terminal.id,
            task_id,
            instruction
        );

        Ok(())
    }

    /// Builds a task instruction from task and terminal information.
    fn build_task_instruction(
        workflow_id: &str,
        task: &db::models::WorkflowTask,
        terminal: &db::models::Terminal,
        total_terminals: usize,
    ) -> String {
        let mut parts = vec![format!("Start task: {} ({})", task.name, task.id)];

        if let Some(description) = &task.description {
            let normalized = description
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            if !normalized.is_empty() {
                if total_terminals > 1 {
                    let summary = Self::truncate_instruction_text(&normalized, 200);
                    parts.push(format!("Task objective: {}", summary));
                } else {
                    parts.push(format!("Task description: {}", normalized));
                }
            }
        }

        if let Some(role) = &terminal.role {
            let role = role.trim();
            if !role.is_empty() {
                parts.push(format!("Your role: {role}"));
            }
        }

        if let Some(role_description) = &terminal.role_description {
            let normalized = role_description
                .split_whitespace()
                .collect::<Vec<_>>()
                .join(" ");
            if !normalized.is_empty() {
                parts.push(format!("Role description: {}", normalized));
            }
        }

        if total_terminals > 1 {
            let terminal_order = (terminal.order_index + 1).max(1);
            parts.push(format!(
                "Execution context: terminal {terminal_order}/{total_terminals}."
            ));
            parts.push(
                "Focus only on your scoped role and do not take over work assigned to other terminals."
                    .to_string(),
            );
            parts.push(
                "When finished, leave concise handoff notes for the next terminal."
                    .to_string(),
            );
        }

        let terminal_order = (terminal.order_index + 1).max(1);
        let commit_metadata_template = format!(
            "{separator}\\nworkflow_id: {workflow_id}\\ntask_id: {task_id}\\nterminal_id: {terminal_id}\\nterminal_order: {terminal_order}\\nstatus: completed\\nnext_action: continue",
            separator = GIT_COMMIT_METADATA_SEPARATOR,
            task_id = task.id,
            terminal_id = terminal.id,
            terminal_order = terminal_order,
        );
        parts.push(
            "Completion contract: when your scoped work is done, you MUST create a git commit before stopping."
                .to_string(),
        );
        parts.push(format!(
            "Commit message must include this metadata block exactly: {commit_metadata_template}"
        ));
        parts.push(
            "If there are no file changes, create an empty commit with --allow-empty so GitWatcher/Orchestrator can advance."
                .to_string(),
        );

        parts.push("Please start implementing immediately.".to_string());

        parts.join(" | ")
    }

    fn truncate_instruction_text(input: &str, max_chars: usize) -> String {
        let char_count = input.chars().count();
        if char_count <= max_chars {
            return input.to_string();
        }

        let truncated: String = input.chars().take(max_chars).collect();
        format!("{truncated}…")
    }

    /// Auto-dispatches the first terminal for each task when workflow starts.
    ///
    /// This method is called after the workflow enters running state to automatically
    /// start execution of all tasks by dispatching their first terminals.
    async fn auto_dispatch_initial_tasks(&self) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // Get all tasks for this workflow
        let tasks = db::models::WorkflowTask::find_by_workflow(&self.db.pool, &workflow_id)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get workflow tasks: {e}"))?;

        if tasks.is_empty() {
            tracing::info!(
                "No tasks found for workflow {}, skipping auto-dispatch",
                workflow_id
            );
            return Ok(());
        }

        tracing::info!(
            "Auto-dispatching initial terminals for {} tasks in workflow {}",
            tasks.len(),
            workflow_id
        );

        for task in tasks {
            // Skip tasks that are already completed, failed, or cancelled
            if task.status == "completed" || task.status == "failed" || task.status == "cancelled" {
                tracing::debug!("Skipping task {} due to status {}", task.id, task.status);
                continue;
            }

            // Get terminals for this task
            let terminals = db::models::Terminal::find_by_task(&self.db.pool, &task.id)
                .await
                .map_err(|e| {
                    anyhow::anyhow!("Failed to get terminals for task {}: {e}", task.id)
                })?;

            if terminals.is_empty() {
                tracing::warn!("No terminals found for task {}, skipping", task.id);
                continue;
            }

            // Initialize task state
            {
                let mut state = self.state.write().await;
                if !state.task_states.contains_key(&task.id) {
                    state.init_task(task.id.clone(), terminals.len());
                }
            }

            // Get next terminal index (should be 0 for initial dispatch)
            let next_index = {
                let state = self.state.read().await;
                state.get_next_terminal_for_task(&task.id)
            };

            let Some(index) = next_index else {
                tracing::debug!("No pending terminals for task {}", task.id);
                continue;
            };

            let Some(terminal) = terminals.get(index).cloned() else {
                tracing::warn!("Terminal index {} out of range for task {}", index, task.id);
                continue;
            };

            // Only dispatch terminals in waiting status
            if terminal.status != "waiting" {
                tracing::debug!(
                    "Skipping terminal {} for task {} due to status {}",
                    terminal.id,
                    task.id,
                    terminal.status
                );
                continue;
            }

            // Build and dispatch instruction
            let instruction =
                Self::build_task_instruction(&workflow_id, &task, &terminal, terminals.len());
            if let Err(e) = self
                .dispatch_terminal(&task.id, &terminal, &instruction)
                .await
            {
                tracing::error!(
                    "Failed to auto-dispatch terminal {} for task {}: {}",
                    terminal.id,
                    task.id,
                    e
                );
                // Continue with other tasks even if one fails
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
        db::models::Workflow::update_status(&self.db.pool, &workflow_id, status).await?;

        // 3. Publish to message bus (synchronously await result)
        let message = BusMessage::StatusUpdate {
            workflow_id: workflow_id.clone(),
            status: status.to_string(),
        };
        self.message_bus
            .publish_workflow_event(&workflow_id, message)
            .await?;

        tracing::debug!("Broadcast workflow status: {} -> {}", workflow_id, status);

        Ok(())
    }

    /// Broadcast terminal status update
    ///
    /// Updates the terminal status in the database and broadcasts
    /// a TerminalStatusUpdate message to the workflow's message bus topic.
    pub async fn broadcast_terminal_status(
        &self,
        terminal_id: &str,
        status: &str,
    ) -> anyhow::Result<()> {
        // 1. Get workflow_id
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // 2. Update database (synchronously await result)
        db::models::Terminal::update_status(&self.db.pool, terminal_id, status).await?;

        // 3. Publish to message bus (synchronously await result)
        let message = BusMessage::TerminalStatusUpdate {
            workflow_id: workflow_id.clone(),
            terminal_id: terminal_id.to_string(),
            status: status.to_string(),
        };
        self.message_bus
            .publish_workflow_event(&workflow_id, message)
            .await?;

        tracing::debug!("Broadcast terminal status: {} -> {}", terminal_id, status);

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
        db::models::WorkflowTask::update_status(&self.db.pool, task_id, status).await?;

        // 3. Publish to message bus (synchronously await result)
        let message = BusMessage::TaskStatusUpdate {
            workflow_id: workflow_id.clone(),
            task_id: task_id.to_string(),
            status: status.to_string(),
        };
        self.message_bus
            .publish_workflow_event(&workflow_id, message)
            .await?;

        tracing::debug!("Broadcast task status: {} -> {}", task_id, status);

        Ok(())
    }

    /// Triggers merge of all completed task branches into the target branch.
    ///
    /// Called when all terminals for a task have completed successfully.
    /// Merges each task branch into the target branch using squash merge.
    ///
    /// # Arguments
    /// * `task_branches` - Map of task_id to branch name for all completed tasks
    /// * `base_repo_path` - Path to the base repository
    /// * `target_branch` - Target branch name (e.g., "main")
    ///
    /// # Returns
    /// * `Ok(())` - All merges completed successfully
    /// * `Err(anyhow::Error)` - If any merge fails
    pub async fn trigger_merge(
        &self,
        task_branches: HashMap<String, String>,
        base_repo_path: &str,
        target_branch: &str,
    ) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        tracing::info!(
            "Triggering merge for {} task branches into {}",
            task_branches.len(),
            target_branch
        );

        let base_repo_path = std::path::Path::new(base_repo_path);
        let git_service = crate::services::git::GitService::new();

        // Merge each task branch
        for (task_id, task_branch) in task_branches {
            tracing::info!("Merging task branch {} for task {}", task_branch, task_id);

            // Determine task worktree path
            let task_worktree_path = base_repo_path.join("worktrees").join(&task_branch);

            // Perform the merge
            let commit_message = format!("Merge task {} ({})", task_id, task_branch);
            match git_service.merge_changes(
                base_repo_path,
                &task_worktree_path,
                &task_branch,
                target_branch,
                &commit_message,
            ) {
                Ok(commit_sha) => {
                    tracing::info!(
                        "Successfully merged task branch {}: {}",
                        task_branch,
                        commit_sha
                    );

                    // Broadcast merge success for this task
                    let message = BusMessage::StatusUpdate {
                        workflow_id: workflow_id.clone(),
                        status: WORKFLOW_STATUS_COMPLETED.to_string(),
                    };
                    self.message_bus
                        .publish_workflow_event(&workflow_id, message)
                        .await?;
                }
                Err(e) => {
                    // Check if this is a merge conflict
                    let is_conflict =
                        matches!(e, crate::services::git::GitServiceError::MergeConflicts(_));

                    if is_conflict {
                        tracing::warn!(
                            "Merge conflict detected for task branch {}: {}",
                            task_branch,
                            e
                        );

                        // Update workflow status to "merging"
                        db::models::Workflow::update_status(
                            &self.db.pool,
                            &workflow_id,
                            WORKFLOW_STATUS_MERGING,
                        )
                        .await?;

                        // Broadcast merging status
                        let message = BusMessage::StatusUpdate {
                            workflow_id: workflow_id.clone(),
                            status: WORKFLOW_STATUS_MERGING.to_string(),
                        };
                        self.message_bus
                            .publish_workflow_event(&workflow_id, message)
                            .await?;

                        return Err(anyhow::anyhow!(
                            "Merge conflict detected for task branch {}: {}",
                            task_branch,
                            e
                        ));
                    }

                    // Other error - fail workflow
                    tracing::error!("Merge failed for task branch {}: {}", task_branch, e);

                    db::models::Workflow::update_status(
                        &self.db.pool,
                        &workflow_id,
                        WORKFLOW_STATUS_FAILED,
                    )
                    .await?;

                    let message = BusMessage::Error {
                        workflow_id: workflow_id.clone(),
                        error: format!("Merge failed for task {}: {}", task_id, e),
                    };
                    self.message_bus
                        .publish_workflow_event(&workflow_id, message)
                        .await?;

                    return Err(anyhow::anyhow!(
                        "Merge failed for task branch {}: {}",
                        task_branch,
                        e
                    ));
                }
            }
        }

        tracing::info!(
            "All task branches merged successfully into {}",
            target_branch
        );

        Ok(())
    }

    /// Handle terminal failure
    ///
    /// Wrapper around ErrorHandler::handle_terminal_failure that uses
    /// the agent's workflow_id, message_bus, and db.
    pub async fn handle_terminal_failure(
        &self,
        task_id: &str,
        terminal_id: &str,
        error_message: &str,
    ) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        self.error_handler
            .handle_terminal_failure(&workflow_id, task_id, terminal_id, error_message)
            .await
    }

    /// Handle user response for an interactive terminal prompt.
    ///
    /// Wrapper around PromptHandler::handle_user_approval that resolves
    /// workflow_id and terminal session_id from the agent/database context.
    pub async fn handle_user_prompt_response(
        &self,
        terminal_id: &str,
        user_response: &str,
    ) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        let terminal = db::models::Terminal::find_by_id(&self.db.pool, terminal_id)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get terminal: {e}"))?
            .ok_or_else(|| anyhow::anyhow!("Terminal {terminal_id} not found"))?;

        let workflow_task_id = terminal.workflow_task_id.clone();
        let task = db::models::WorkflowTask::find_by_id(&self.db.pool, &workflow_task_id)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get workflow task: {e}"))?
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "Workflow task {} not found for terminal {}",
                    workflow_task_id,
                    terminal_id
                )
            })?;

        if task.workflow_id != workflow_id {
            return Err(anyhow!(
                "Terminal {} does not belong to workflow {}",
                terminal_id,
                workflow_id
            ));
        }

        let session_id = terminal
            .pty_session_id
            .or(terminal.session_id)
            .filter(|id| !id.trim().is_empty())
            .ok_or_else(|| {
                anyhow!(
                    "Terminal {} has no session_id for prompt response",
                    terminal_id
                )
            })?;

        let handled = self
            .prompt_handler
            .handle_user_prompt_response(terminal_id, &session_id, &workflow_id, user_response)
            .await;

        if !handled {
            return Err(anyhow!(
                "Terminal {} is not waiting for prompt approval in workflow {}",
                terminal_id,
                workflow_id
            ));
        }

        Ok(())
    }

    /// Execute slash commands for this workflow
    ///
    /// Loads all slash commands associated with the workflow, renders their
    /// templates with custom parameters and workflow context, and sends the
    /// rendered prompts to the LLM.
    ///
    /// This should be called once when the agent starts, before processing
    /// any terminal events.
    pub async fn execute_slash_commands(&self) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // Load workflow to check if slash commands are enabled
        let workflow = db::models::Workflow::find_by_id(&self.db.pool, &workflow_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Workflow {} not found", workflow_id))?;

        if !workflow.use_slash_commands {
            tracing::info!("Slash commands disabled for workflow {}", workflow_id);
            return Ok(());
        }

        // Load workflow commands
        let commands =
            db::models::WorkflowCommand::find_by_workflow(&self.db.pool, &workflow_id).await?;

        if commands.is_empty() {
            tracing::info!("No slash commands configured for workflow {}", workflow_id);
            return Ok(());
        }

        // Load all presets
        let all_presets = db::models::SlashCommandPreset::find_all(&self.db.pool).await?;

        tracing::info!(
            "Executing {} slash command(s) for workflow {}",
            commands.len(),
            workflow_id
        );

        // Create template renderer
        let renderer = TemplateRenderer::new();

        // Create workflow context
        let workflow_ctx = WorkflowContext::new(
            workflow.name.clone(),
            workflow.description.clone(),
            workflow.target_branch.clone(),
        );

        // Execute each command in order
        for (index, cmd) in commands.iter().enumerate() {
            // Find the preset for this command
            let preset = all_presets
                .iter()
                .find(|p| p.id == cmd.preset_id)
                .ok_or_else(|| anyhow::anyhow!("Preset {} not found for command", cmd.preset_id))?;

            let template = preset.prompt_template.as_deref().unwrap_or("");

            // Render the template with custom params and workflow context
            let rendered_prompt = renderer
                .render(template, cmd.custom_params.as_deref(), Some(&workflow_ctx))
                .map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to render template for command {}: {} (index {})",
                        preset.command,
                        e,
                        index
                    )
                })?;

            tracing::info!(
                "Executing slash command {}: {} (index {})",
                preset.command,
                index,
                cmd.order_index
            );

            // Add rendered prompt as user message to conversation
            {
                let mut state = self.state.write().await;
                state.add_message("user", &rendered_prompt, &self.config);
            }

            // Send to LLM and get response
            let response = self
                .llm_client
                .chat({
                    let state = self.state.read().await;
                    state.conversation_history.clone()
                })
                .await?;

            // Add assistant response to conversation
            {
                let mut state = self.state.write().await;
                state.add_message("assistant", &response.content, &self.config);
                if let Some(usage) = &response.usage {
                    state.total_tokens_used += i64::from(usage.total_tokens);
                }
            }

            tracing::info!(
                "Slash command {} completed. LLM response: {} chars",
                preset.command,
                response.content.len()
            );
        }

        tracing::info!("All slash commands executed for workflow {}", workflow_id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::OrchestratorAgent;

    fn make_task(description: Option<&str>) -> db::models::WorkflowTask {
        let now = Utc::now();
        db::models::WorkflowTask {
            id: "task-1".to_string(),
            workflow_id: "workflow-1".to_string(),
            vk_task_id: None,
            name: "Implement feature".to_string(),
            description: description.map(str::to_string),
            branch: "workflow/workflow-1/implement-feature".to_string(),
            status: "pending".to_string(),
            order_index: 0,
            started_at: None,
            completed_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    fn make_terminal(order_index: i32) -> db::models::Terminal {
        let now = Utc::now();
        db::models::Terminal {
            id: format!("terminal-{order_index}"),
            workflow_task_id: "task-1".to_string(),
            cli_type_id: "cli-codex".to_string(),
            model_config_id: "model-1".to_string(),
            custom_base_url: None,
            custom_api_key: None,
            role: Some("backend developer".to_string()),
            role_description: Some("Implement backend service only".to_string()),
            order_index,
            status: "waiting".to_string(),
            process_id: None,
            pty_session_id: None,
            session_id: None,
            execution_process_id: None,
            vk_session_id: None,
            auto_confirm: true,
            last_commit_hash: None,
            last_commit_message: None,
            started_at: None,
            completed_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn build_task_instruction_for_multi_terminal_uses_objective_not_full_description() {
        let workflow_id = "workflow-1";
        let task = make_task(Some(
            "Build a local guestbook with frontend and backend, persist to local json file and display in UI",
        ));
        let terminal = make_terminal(0);

        let instruction =
            OrchestratorAgent::build_task_instruction(workflow_id, &task, &terminal, 3);

        assert!(instruction.contains("Task objective:"));
        assert!(!instruction.contains("Task description:"));
        assert!(instruction.contains("Execution context: terminal 1/3."));
        assert!(instruction.contains("Focus only on your scoped role"));
        assert!(instruction.contains("Completion contract:"));
        assert!(instruction.contains("workflow_id: workflow-1"));
        assert!(instruction.contains("task_id: task-1"));
        assert!(instruction.contains("terminal_id: terminal-0"));
        assert!(instruction.contains("status: completed"));
        assert!(instruction.contains("next_action: continue"));
    }

    #[test]
    fn build_task_instruction_for_single_terminal_keeps_full_description() {
        let workflow_id = "workflow-1";
        let task = make_task(Some("Complete full implementation end-to-end"));
        let terminal = make_terminal(0);

        let instruction =
            OrchestratorAgent::build_task_instruction(workflow_id, &task, &terminal, 1);

        assert!(instruction.contains("Task description: Complete full implementation end-to-end"));
        assert!(!instruction.contains("Task objective:"));
        assert!(!instruction.contains("Execution context:"));
        assert!(instruction.contains("Completion contract:"));
    }

    #[test]
    fn truncate_instruction_text_limits_length_with_ellipsis() {
        let input = "a".repeat(260);
        let result = OrchestratorAgent::truncate_instruction_text(&input, 200);

        assert_eq!(result.chars().count(), 201);
        assert!(result.ends_with('…'));
    }
}
