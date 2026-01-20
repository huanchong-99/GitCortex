//! Orchestrator state tracking and transitions.

use std::collections::HashMap;

use tokio::sync::RwLock;

use super::config::OrchestratorConfig;
use super::types::{LLMMessage, TerminalCompletionEvent};

/// Execution state for the orchestrator event loop.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrchestratorRunState {
    /// Idle and waiting for events.
    Idle,
    /// Processing events or instructions.
    Processing,
    /// Paused pending user or system action.
    Paused,
    /// Stopped and no longer processing.
    Stopped,
}

/// Tracks per-task terminal execution progress.
#[derive(Debug, Clone)]
pub struct TaskExecutionState {
    pub task_id: String,
    pub current_terminal_index: usize,
    pub total_terminals: usize,
    pub completed_terminals: Vec<String>,
    pub failed_terminals: Vec<String>,
    pub is_completed: bool,
}

/// In-memory orchestrator state for a workflow.
pub struct OrchestratorState {
    /// Current run state for the event loop.
    pub run_state: OrchestratorRunState,

    /// Workflow identifier.
    pub workflow_id: String,

    /// Per-task execution state.
    pub task_states: HashMap<String, TaskExecutionState>,

    /// Conversation history for LLM context.
    pub conversation_history: Vec<LLMMessage>,

    /// Pending terminal completion events.
    pub pending_events: Vec<TerminalCompletionEvent>,

    /// Total tokens consumed by the LLM.
    pub total_tokens_used: i64,

    /// Total error count for this workflow run.
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

    /// Initializes execution state for a task.
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

    /// Records a terminal completion for a task.
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

    /// Appends a message and trims history based on config.
    pub fn add_message(&mut self, role: &str, content: &str, config: &OrchestratorConfig) {
        self.conversation_history.push(LLMMessage {
            role: role.to_string(),
            content: content.to_string(),
        });

        // 使用配置中的最大历史长度限制，避免上下文过长
        if self.conversation_history.len() > config.max_conversation_history {
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
                .take(config.max_conversation_history - system_msgs.len())
                .cloned()
                .collect();

            self.conversation_history = system_msgs;
            self.conversation_history.extend(recent.into_iter().rev());
        }
    }

    /// Returns true if all tasks are completed.
    pub fn all_tasks_completed(&self) -> bool {
        self.task_states.values().all(|s| s.is_completed)
    }

    /// Returns true if any task has failed terminals.
    pub fn has_failed_tasks(&self) -> bool {
        self.task_states
            .values()
            .any(|s| !s.failed_terminals.is_empty())
    }

    /// Validates and performs a run-state transition.
    pub fn transition_to(
        &mut self,
        new_state: OrchestratorRunState,
    ) -> anyhow::Result<()> {
        let valid_transitions = matches!(
            (self.run_state, new_state),
            (OrchestratorRunState::Idle | OrchestratorRunState::Paused, OrchestratorRunState::Processing)
                | (OrchestratorRunState::Idle | OrchestratorRunState::Processing, OrchestratorRunState::Paused)
                | (OrchestratorRunState::Idle | OrchestratorRunState::Processing | OrchestratorRunState::Paused, OrchestratorRunState::Stopped)
                | (OrchestratorRunState::Processing | OrchestratorRunState::Paused, OrchestratorRunState::Idle)
        );

        if !valid_transitions {
            tracing::error!(
                "Invalid state transition: {:?} ??{:?}",
                self.run_state,
                new_state
            );
        }

        if valid_transitions {
            tracing::debug!("State transition: {:?} → {:?}", self.run_state, new_state);
            self.run_state = new_state;
            Ok(())
        } else {
            Err(anyhow::anyhow!(
                "Invalid state transition: {:?} → {:?}",
                self.run_state, new_state
            ))
        }
    }
}

/// Thread-safe shared orchestrator state.
pub type SharedOrchestratorState = std::sync::Arc<RwLock<OrchestratorState>>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_state_transitions() {
        let mut state = OrchestratorState::new("test-workflow".to_string());

        // Idle -> Processing
        assert!(state.transition_to(OrchestratorRunState::Processing).is_ok());
        assert_eq!(state.run_state, OrchestratorRunState::Processing);

        // Processing -> Paused
        assert!(state.transition_to(OrchestratorRunState::Paused).is_ok());

        // Paused -> Processing
        assert!(state.transition_to(OrchestratorRunState::Processing).is_ok());

        // Processing -> Idle
        assert!(state.transition_to(OrchestratorRunState::Idle).is_ok());

        // Idle -> Paused
        assert!(state.transition_to(OrchestratorRunState::Paused).is_ok());

        // Paused -> Stopped
        assert!(state.transition_to(OrchestratorRunState::Stopped).is_ok());
        assert_eq!(state.run_state, OrchestratorRunState::Stopped);
    }

    #[test]
    fn test_invalid_state_transitions() {
        let mut state = OrchestratorState::new("test-workflow".to_string());

        // Can't stay in the same state
        assert!(state.transition_to(OrchestratorRunState::Processing).is_ok());
        let result = state.transition_to(OrchestratorRunState::Processing);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid state transition"));

        // After Stopped, can't transition to other states
        state.run_state = OrchestratorRunState::Stopped;
        assert!(state.transition_to(OrchestratorRunState::Processing).is_err());
        assert!(state.transition_to(OrchestratorRunState::Idle).is_err());
        assert!(state.transition_to(OrchestratorRunState::Paused).is_err());
    }

    #[test]
    fn test_all_valid_transitions_from_idle() {
        let mut state = OrchestratorState::new("test-workflow".to_string());

        // From Idle, can go to Processing, Paused, or Stopped
        assert!(state.transition_to(OrchestratorRunState::Processing).is_ok());
        state.run_state = OrchestratorRunState::Idle;

        assert!(state.transition_to(OrchestratorRunState::Paused).is_ok());
        state.run_state = OrchestratorRunState::Idle;

        assert!(state.transition_to(OrchestratorRunState::Stopped).is_ok());
    }

    #[test]
    fn test_all_valid_transitions_from_processing() {
        let mut state = OrchestratorState::new("test-workflow".to_string());
        state.run_state = OrchestratorRunState::Processing;

        // From Processing, can go to Idle, Paused, or Stopped
        assert!(state.transition_to(OrchestratorRunState::Idle).is_ok());
        state.run_state = OrchestratorRunState::Processing;

        assert!(state.transition_to(OrchestratorRunState::Paused).is_ok());
        state.run_state = OrchestratorRunState::Processing;

        assert!(state.transition_to(OrchestratorRunState::Stopped).is_ok());
    }

    #[test]
    fn test_all_valid_transitions_from_paused() {
        let mut state = OrchestratorState::new("test-workflow".to_string());
        state.run_state = OrchestratorRunState::Paused;

        // From Paused, can go to Processing, Idle, or Stopped
        assert!(state.transition_to(OrchestratorRunState::Processing).is_ok());
        state.run_state = OrchestratorRunState::Paused;

        assert!(state.transition_to(OrchestratorRunState::Idle).is_ok());
        state.run_state = OrchestratorRunState::Paused;

        assert!(state.transition_to(OrchestratorRunState::Stopped).is_ok());
    }
}
