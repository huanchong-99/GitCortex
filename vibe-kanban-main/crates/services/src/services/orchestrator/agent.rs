//! Orchestrator Agent 主逻辑

use std::sync::Arc;

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
    async fn handle_git_event(
        &self,
        _workflow_id: &str,
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
        // Git 事件通常会转换为 TerminalCompleted 事件
        Ok(())
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
                        BusMessage::TerminalMessage { message: message.clone() }
                    ).await;

                    tracing::debug!("Message sent to terminal {}", terminal_id);
                }
                OrchestratorInstruction::CompleteWorkflow { summary } => {
                    tracing::info!("Workflow completed: {}", summary);
                }
                OrchestratorInstruction::FailWorkflow { reason } => {
                    tracing::error!("Workflow failed: {}", reason);
                }
                _ => {}
            }
        }
        Ok(())
    }
}
