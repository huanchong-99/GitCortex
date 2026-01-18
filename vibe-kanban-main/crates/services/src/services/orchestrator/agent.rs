//! Orchestrator Agent 主逻辑

use std::sync::Arc;

use anyhow::anyhow;
use db::DBService;
use tokio::sync::RwLock;

use super::{
    config::OrchestratorConfig,
    llm::{LLMClient, create_llm_client},
    message_bus::{BusMessage, MessageBus, SharedMessageBus},
    state::{OrchestratorRunState, OrchestratorState, SharedOrchestratorState},
    types::*,
};

pub struct OrchestratorAgent {
    config: OrchestratorConfig,
    state: SharedOrchestratorState,
    message_bus: SharedMessageBus,
    llm_client: Box<dyn LLMClient>,
    db: Arc<DBService>,
}

impl OrchestratorAgent {
    pub async fn new(
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
    pub async fn with_llm_client(
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

    /// 启动 Agent 事件循环
    pub async fn run(&self) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        let mut rx = self
            .message_bus
            .subscribe(&format!("workflow:{}", workflow_id))
            .await;
        tracing::info!("Orchestrator started for workflow: {}", workflow_id);

        // 初始化系统消息
        {
            let mut state = self.state.write().await;
            state.add_message("system", &self.config.system_prompt);
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

    /// 处理消息
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

    /// 处理终端完成事件
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
        let prompt = self.build_completion_prompt(&event).await;
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

    /// 处理 Git 事件
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
            "completed" => {
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
            "failed" => {
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
            "completed"
        ).await?;

        // 2. Publish completion event
        let event = BusMessage::TerminalCompleted(TerminalCompletionEvent {
            terminal_id: terminal_id.to_string(),
            task_id: task_id.to_string(),
            workflow_id: self.state.read().await.workflow_id.clone(),
            status: TerminalCompletionStatus::Completed,
            commit_hash: Some(commit_hash.to_string()),
            commit_message: Some(commit_message.to_string()),
            metadata: None,
        });

        self.message_bus.publish(
            &format!("workflow:{}", self.state.read().await.workflow_id),
            event
        ).await?;

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
            "review_passed"
        ).await?;

        // 2. Publish review passed event
        let event = BusMessage::StatusUpdate {
            workflow_id: self.state.read().await.workflow_id.clone(),
            status: "review_passed".to_string(),
        };

        self.message_bus.publish(
            &format!("workflow:{}", self.state.read().await.workflow_id),
            event
        ).await?;

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
            "review_rejected"
        ).await?;

        // 2. Publish review rejected event
        let event = BusMessage::StatusUpdate {
            workflow_id: self.state.read().await.workflow_id.clone(),
            status: "review_rejected".to_string(),
        };

        self.message_bus.publish(
            &format!("workflow:{}", self.state.read().await.workflow_id),
            event
        ).await?;

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
            "failed"
        ).await?;

        // 2. Publish failure event
        let event = BusMessage::Error {
            workflow_id: self.state.read().await.workflow_id.clone(),
            error: error_message.to_string(),
        };

        self.message_bus.publish(
            &format!("workflow:{}", self.state.read().await.workflow_id),
            event
        ).await?;

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

    /// 构建完成提示
    async fn build_completion_prompt(&self, event: &TerminalCompletionEvent) -> String {
        format!(
            "终端 {} 已完成任务。\n状态: {:?}\n提交: {:?}\n消息: {:?}\n\n请决定下一步操作。",
            event.terminal_id, event.status, event.commit_hash, event.commit_message
        )
    }

    /// 调用 LLM
    async fn call_llm(&self, prompt: &str) -> anyhow::Result<String> {
        let mut state = self.state.write().await;
        state.add_message("user", prompt);

        let messages = state.conversation_history.clone();
        drop(state);

        let response = self.llm_client.chat(messages).await?;

        let mut state = self.state.write().await;
        state.add_message("assistant", &response.content);
        if let Some(usage) = &response.usage {
            state.total_tokens_used += usage.total_tokens as i64;
        }

        Ok(response.content)
    }

    /// 执行指令
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
                    let terminal = db::models::Terminal::find_by_id(&self.db.pool, &terminal_id).await
                        .map_err(|e| anyhow::anyhow!("Failed to get terminal: {}", e))?
                        .ok_or_else(|| anyhow::anyhow!("Terminal {} not found", terminal_id))?;

                    // 2. Get PTY session ID
                    let pty_session_id = terminal.pty_session_id
                        .ok_or_else(|| anyhow::anyhow!("Terminal {} has no PTY session", terminal_id))?;

                    // 3. Send message via message bus
                    self.message_bus.publish(
                        &pty_session_id,
                        BusMessage::TerminalMessage { message }
                    ).await
                    .map_err(|e| anyhow::anyhow!("Failed to send message: {}", e))?;

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
                        "completed"
                    ).await
                    .map_err(|e| anyhow::anyhow!("Failed to update workflow status: {}", e))?;

                    // Publish completion event
                    self.message_bus.publish(
                        &format!("workflow:{}", workflow_id),
                        BusMessage::StatusUpdate {
                            workflow_id: workflow_id.clone(),
                            status: "completed".to_string(),
                        }
                    ).await
                    .map_err(|e| anyhow::anyhow!("Failed to publish completion event: {}", e))?;

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
                        "failed"
                    ).await
                    .map_err(|e| anyhow::anyhow!("Failed to update workflow status: {}", e))?;

                    // Publish failure event
                    self.message_bus.publish(
                        &format!("workflow:{}", workflow_id),
                        BusMessage::Error {
                            workflow_id: workflow_id.clone(),
                            error: reason.clone(),
                        }
                    ).await
                    .map_err(|e| anyhow::anyhow!("Failed to publish failure event: {}", e))?;

                    // Transition to Idle
                    self.state.write().await.run_state = OrchestratorRunState::Idle;

                    tracing::error!("Workflow {} failed: {}", workflow_id, reason);
                }
                _ => {}
            }
        }
        Ok(())
    }
}
