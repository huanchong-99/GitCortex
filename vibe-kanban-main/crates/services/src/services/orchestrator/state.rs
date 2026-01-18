//! Orchestrator 状态管理

use std::collections::HashMap;

use tokio::sync::RwLock;

use super::types::*;

/// Orchestrator 运行状态
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrchestratorRunState {
    /// 空闲（等待事件）
    Idle,
    /// 处理中
    Processing,
    /// 已暂停
    Paused,
    /// 已停止
    Stopped,
}

/// 任务执行状态
#[derive(Debug, Clone)]
pub struct TaskExecutionState {
    pub task_id: String,
    pub current_terminal_index: usize,
    pub total_terminals: usize,
    pub completed_terminals: Vec<String>,
    pub failed_terminals: Vec<String>,
    pub is_completed: bool,
}

/// Orchestrator 状态
pub struct OrchestratorState {
    /// 运行状态
    pub run_state: OrchestratorRunState,

    /// 工作流 ID
    pub workflow_id: String,

    /// 任务执行状态
    pub task_states: HashMap<String, TaskExecutionState>,

    /// 对话历史（用于 LLM 上下文）
    pub conversation_history: Vec<LLMMessage>,

    /// 待处理事件队列
    pub pending_events: Vec<TerminalCompletionEvent>,

    /// Token 使用统计
    pub total_tokens_used: i64,

    /// 错误计数
    pub error_count: u32,
}

impl OrchestratorState {
    pub fn new(workflow_id: String) -> Self {
        Self {
            run_state: OrchestratorRunState::Idle,
            workflow_id,
            task_states: HashMap::new(),
            conversation_history: Vec::new(),
            pending_events: Vec::new(),
            total_tokens_used: 0,
            error_count: 0,
        }
    }

    /// 初始化任务状态
    pub fn init_task(&mut self, task_id: String, terminal_count: usize) {
        self.task_states.insert(
            task_id.clone(),
            TaskExecutionState {
                task_id,
                current_terminal_index: 0,
                total_terminals: terminal_count,
                completed_terminals: Vec::new(),
                failed_terminals: Vec::new(),
                is_completed: false,
            },
        );
    }

    /// 标记终端完成
    pub fn mark_terminal_completed(&mut self, task_id: &str, terminal_id: &str, success: bool) {
        if let Some(state) = self.task_states.get_mut(task_id) {
            if success {
                state.completed_terminals.push(terminal_id.to_string());
            } else {
                state.failed_terminals.push(terminal_id.to_string());
            }

            // 检查任务是否完成
            let total_done = state.completed_terminals.len() + state.failed_terminals.len();
            if total_done >= state.total_terminals {
                state.is_completed = true;
            }
        }
    }

    /// 添加消息到对话历史
    pub fn add_message(&mut self, role: &str, content: &str) {
        self.conversation_history.push(LLMMessage {
            role: role.to_string(),
            content: content.to_string(),
        });

        // 限制历史长度，避免上下文过长
        const MAX_HISTORY: usize = 50;
        if self.conversation_history.len() > MAX_HISTORY {
            // 保留系统消息和最近的消息
            let system_msgs: Vec<_> = self
                .conversation_history
                .iter()
                .filter(|m| m.role == "system")
                .cloned()
                .collect();
            let recent: Vec<_> = self
                .conversation_history
                .iter()
                .rev()
                .take(MAX_HISTORY - system_msgs.len())
                .cloned()
                .collect();

            self.conversation_history = system_msgs;
            self.conversation_history.extend(recent.into_iter().rev());
        }
    }

    /// 检查所有任务是否完成
    pub fn all_tasks_completed(&self) -> bool {
        self.task_states.values().all(|s| s.is_completed)
    }

    /// 检查是否有失败的任务
    pub fn has_failed_tasks(&self) -> bool {
        self.task_states
            .values()
            .any(|s| !s.failed_terminals.is_empty())
    }
}

/// 线程安全的状态包装
pub type SharedOrchestratorState = std::sync::Arc<RwLock<OrchestratorState>>;
