//! Orchestrator 类型定义

use serde::{Deserialize, Serialize};

// ============================================================================
// Prompt Types (re-exported from terminal module for convenience)
// ============================================================================
pub use crate::services::terminal::{
    ARROW_DOWN, ARROW_UP, ArrowSelectOption, DetectedPrompt, PromptDetector, PromptKind,
    build_arrow_sequence,
};

/// 主 Agent 指令类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OrchestratorInstruction {
    /// 启动任务
    StartTask {
        task_id: String,
        instruction: String,
    },
    /// 发送消息到终端
    SendToTerminal {
        terminal_id: String,
        message: String,
    },
    /// 审核代码
    ReviewCode {
        terminal_id: String,
        commit_hash: String,
    },
    /// 修复问题
    FixIssues {
        terminal_id: String,
        issues: Vec<String>,
    },
    /// 合并分支
    MergeBranch {
        source_branch: String,
        target_branch: String,
    },
    /// 暂停工作流
    PauseWorkflow { reason: String },
    /// 完成工作流
    CompleteWorkflow { summary: String },
    /// 失败工作流
    FailWorkflow { reason: String },
}

/// 终端完成事件
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalCompletionEvent {
    pub terminal_id: String,
    pub task_id: String,
    pub workflow_id: String,
    pub status: TerminalCompletionStatus,
    pub commit_hash: Option<String>,
    pub commit_message: Option<String>,
    pub metadata: Option<CommitMetadata>,
}

/// 终端完成状态
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TerminalCompletionStatus {
    /// 任务完成
    Completed,
    /// 审核通过
    ReviewPass,
    /// 审核打回
    ReviewReject,
    /// 失败
    Failed,
}

/// Git 提交元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitMetadata {
    pub workflow_id: String,
    pub task_id: String,
    pub terminal_id: String,
    pub terminal_order: i32,
    pub cli: String,
    pub model: String,
    pub status: String,
    pub severity: Option<String>,
    pub reviewed_terminal: Option<String>,
    pub issues: Option<Vec<CodeIssue>>,
    pub next_action: String,
}

/// 代码问题
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeIssue {
    pub severity: String,
    pub file: String,
    pub line: Option<i32>,
    pub message: String,
    pub suggestion: Option<String>,
}

/// LLM 消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMMessage {
    pub role: String,
    pub content: String,
}

/// LLM 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMResponse {
    pub content: String,
    pub usage: Option<LLMUsage>,
}

/// LLM 使用量
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMUsage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}

// ============================================================================
// Terminal Prompt Event Types
// ============================================================================

/// Terminal prompt detected event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalPromptEvent {
    /// Terminal ID
    pub terminal_id: String,
    /// Workflow ID
    pub workflow_id: String,
    /// Task ID
    pub task_id: String,
    /// PTY session ID for sending responses
    pub session_id: String,
    /// Whether auto-confirm is enabled for this terminal
    pub auto_confirm: bool,
    /// Detected prompt details
    pub prompt: DetectedPrompt,
    /// Timestamp when prompt was detected
    pub detected_at: chrono::DateTime<chrono::Utc>,
}

/// Decision made by Orchestrator for a prompt
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum PromptDecision {
    /// Auto-confirm: send response immediately without LLM
    AutoConfirm {
        /// Response to send (e.g., "\n" for EnterConfirm)
        response: String,
        /// Reason for auto-confirm
        reason: String,
    },
    /// LLM decision: let LLM decide the response
    LLMDecision {
        /// Response determined by LLM
        response: String,
        /// LLM's reasoning
        reasoning: String,
        /// For ArrowSelect: target index
        target_index: Option<usize>,
    },
    /// Ask user: requires human intervention
    AskUser {
        /// Reason why user input is needed
        reason: String,
        /// Suggested options (if any)
        suggestions: Option<Vec<String>>,
    },
    /// Skip: ignore this prompt (e.g., duplicate detection)
    Skip {
        /// Reason for skipping
        reason: String,
    },
}

impl PromptDecision {
    /// Create an auto-confirm decision for EnterConfirm prompts
    pub fn auto_enter() -> Self {
        Self::AutoConfirm {
            response: "\n".to_string(),
            reason: "EnterConfirm prompt with high confidence".to_string(),
        }
    }

    /// Create an ask-user decision for Password prompts
    pub fn ask_password() -> Self {
        Self::AskUser {
            reason: "Password/sensitive input detected - requires user intervention".to_string(),
            suggestions: None,
        }
    }

    /// Create an LLM decision for YesNo prompts
    pub fn llm_yes_no(answer_yes: bool, reasoning: String) -> Self {
        Self::LLMDecision {
            response: if answer_yes {
                "y\n".to_string()
            } else {
                "n\n".to_string()
            },
            reasoning,
            target_index: None,
        }
    }

    /// Create an LLM decision for ArrowSelect prompts
    pub fn llm_arrow_select(current_index: usize, target_index: usize, reasoning: String) -> Self {
        let arrow_sequence = build_arrow_sequence(current_index, target_index);
        Self::LLMDecision {
            response: format!("{}\n", arrow_sequence),
            reasoning,
            target_index: Some(target_index),
        }
    }

    /// Create an LLM decision for Choice prompts
    pub fn llm_choice(choice: &str, reasoning: String) -> Self {
        Self::LLMDecision {
            response: format!("{}\n", choice),
            reasoning,
            target_index: None,
        }
    }

    /// Create an LLM decision for Input prompts
    pub fn llm_input(input: &str, reasoning: String) -> Self {
        Self::LLMDecision {
            response: format!("{}\n", input),
            reasoning,
            target_index: None,
        }
    }

    /// Create a skip decision
    pub fn skip(reason: &str) -> Self {
        Self::Skip {
            reason: reason.to_string(),
        }
    }
}

/// Terminal prompt state for tracking prompt handling
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PromptState {
    /// No prompt detected
    Idle,
    /// Prompt detected, waiting for decision
    Detected,
    /// Decision made, waiting for response to be sent
    Deciding,
    /// Response sent, waiting for terminal to process
    Responding,
    /// Waiting for user approval (Password prompts)
    WaitingForApproval,
}

impl Default for PromptState {
    fn default() -> Self {
        Self::Idle
    }
}

/// Terminal prompt state machine to prevent duplicate responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalPromptStateMachine {
    /// Current state
    pub state: PromptState,
    /// Last detected prompt (if any)
    pub last_prompt: Option<DetectedPrompt>,
    /// Last decision made (if any)
    pub last_decision: Option<PromptDecision>,
    /// Timestamp of last state change
    pub last_state_change: chrono::DateTime<chrono::Utc>,
    /// Count of consecutive detections (for debouncing)
    pub detection_count: u32,
}

impl Default for TerminalPromptStateMachine {
    fn default() -> Self {
        Self {
            state: PromptState::Idle,
            last_prompt: None,
            last_decision: None,
            last_state_change: chrono::Utc::now(),
            detection_count: 0,
        }
    }
}

impl TerminalPromptStateMachine {
    /// Create a new state machine
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if a new prompt should be processed (debouncing)
    pub fn should_process(&self, prompt: &DetectedPrompt) -> bool {
        match self.state {
            PromptState::Idle => true,
            PromptState::Detected | PromptState::Deciding | PromptState::Responding => {
                // Check if this is a different prompt
                if let Some(ref last) = self.last_prompt {
                    // Different prompt kind = new prompt
                    if last.kind != prompt.kind {
                        return true;
                    }
                    // Same kind but significantly different text = new prompt
                    if last.raw_text != prompt.raw_text {
                        return true;
                    }
                }
                false
            }
            PromptState::WaitingForApproval => false, // Never auto-process while waiting for user
        }
    }

    /// Transition to detected state
    pub fn on_prompt_detected(&mut self, prompt: DetectedPrompt) {
        self.state = PromptState::Detected;
        self.last_prompt = Some(prompt);
        self.last_state_change = chrono::Utc::now();
        self.detection_count += 1;
    }

    /// Transition to deciding state
    pub fn on_deciding(&mut self) {
        self.state = PromptState::Deciding;
        self.last_state_change = chrono::Utc::now();
    }

    /// Transition to responding state
    pub fn on_response_sent(&mut self, decision: PromptDecision) {
        self.state = PromptState::Responding;
        self.last_decision = Some(decision);
        self.last_state_change = chrono::Utc::now();
    }

    /// Transition to waiting for approval state
    pub fn on_waiting_for_approval(&mut self, decision: PromptDecision) {
        self.state = PromptState::WaitingForApproval;
        self.last_decision = Some(decision);
        self.last_state_change = chrono::Utc::now();
    }

    /// Reset to idle state (after response processed or timeout)
    pub fn reset(&mut self) {
        self.state = PromptState::Idle;
        self.last_prompt = None;
        self.last_decision = None;
        self.last_state_change = chrono::Utc::now();
        self.detection_count = 0;
    }

    /// Check if state machine is stale (no activity for given duration)
    pub fn is_stale(&self, timeout: chrono::Duration) -> bool {
        chrono::Utc::now() - self.last_state_change > timeout
    }
}
