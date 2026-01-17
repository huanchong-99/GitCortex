# Phase 3: Orchestrator 主 Agent 实现

> **状态:** ⬜ 未开始
> **进度追踪:** 查看 `TODO.md`
> **前置条件:** Phase 2 完成

## 概述

实现 Orchestrator 主 Agent，包括 LLM 客户端、消息总线和核心协调逻辑。

---

## Phase 3: Orchestrator 主 Agent 实现

### Task 3.1: 创建 Orchestrator 模块结构

**状态:** ⬜ 未开始

**前置条件:**
- Phase 2 已完成
- cc-switch 集成到 services 层

**目标:**
创建 Orchestrator 模块的基础结构，包括配置、状态管理和核心类型定义。

**涉及文件:**
- 创建: `vibe-kanban-main/crates/services/src/services/orchestrator/mod.rs`
- 创建: `vibe-kanban-main/crates/services/src/services/orchestrator/config.rs`
- 创建: `vibe-kanban-main/crates/services/src/services/orchestrator/state.rs`
- 创建: `vibe-kanban-main/crates/services/src/services/orchestrator/types.rs`
- 修改: `vibe-kanban-main/crates/services/src/services/mod.rs`

---

**Step 3.1.1: 创建 types.rs**

文件路径: `vibe-kanban-main/crates/services/src/services/orchestrator/types.rs`

```rust
//! Orchestrator 类型定义

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    PauseWorkflow {
        reason: String,
    },
    /// 完成工作流
    CompleteWorkflow {
        summary: String,
    },
    /// 失败工作流
    FailWorkflow {
        reason: String,
    },
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
```

---

**Step 3.1.2: 创建 config.rs**

文件路径: `vibe-kanban-main/crates/services/src/services/orchestrator/config.rs`

```rust
//! Orchestrator 配置

use serde::{Deserialize, Serialize};

/// Orchestrator 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrchestratorConfig {
    /// API 类型: "openai", "anthropic", "custom"
    pub api_type: String,

    /// API Base URL
    pub base_url: String,

    /// API Key
    pub api_key: String,

    /// 模型名称
    pub model: String,

    /// 最大重试次数
    #[serde(default = "default_max_retries")]
    pub max_retries: u32,

    /// 请求超时（秒）
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,

    /// 系统提示词
    #[serde(default = "default_system_prompt")]
    pub system_prompt: String,
}

fn default_max_retries() -> u32 {
    3
}

fn default_timeout() -> u64 {
    120
}

fn default_system_prompt() -> String {
    r#"你是 GitCortex 的主协调 Agent，负责协调多个 AI 编码代理完成软件开发任务。

你的职责：
1. 根据工作流配置，向各终端发送任务指令
2. 监控终端的执行状态（通过 Git 提交事件）
3. 协调审核流程，处理审核反馈
4. 在所有任务完成后，协调分支合并

规则：
- 每个终端完成任务后会提交 Git，你会收到提交事件
- 根据提交中的元数据判断下一步操作
- 如果审核发现问题，指导修复终端进行修复
- 保持简洁的指令，不要过度解释

输出格式：
使用 JSON 格式输出指令，格式如下：
{"type": "send_to_terminal", "terminal_id": "xxx", "message": "具体指令"}
"#.to_string()
}

impl Default for OrchestratorConfig {
    fn default() -> Self {
        Self {
            api_type: "openai".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: String::new(),
            model: "gpt-4o".to_string(),
            max_retries: default_max_retries(),
            timeout_secs: default_timeout(),
            system_prompt: default_system_prompt(),
        }
    }
}

impl OrchestratorConfig {
    /// 从工作流配置创建
    pub fn from_workflow(
        api_type: Option<&str>,
        base_url: Option<&str>,
        api_key: Option<&str>,
        model: Option<&str>,
    ) -> Option<Self> {
        Some(Self {
            api_type: api_type?.to_string(),
            base_url: base_url?.to_string(),
            api_key: api_key?.to_string(),
            model: model?.to_string(),
            ..Default::default()
        })
    }

    /// 验证配置是否有效
    pub fn validate(&self) -> Result<(), String> {
        if self.api_key.is_empty() {
            return Err("API key is required".to_string());
        }
        if self.base_url.is_empty() {
            return Err("Base URL is required".to_string());
        }
        if self.model.is_empty() {
            return Err("Model is required".to_string());
        }
        Ok(())
    }
}
```

---

**Step 3.1.3: 创建 state.rs**

文件路径: `vibe-kanban-main/crates/services/src/services/orchestrator/state.rs`

```rust
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
        self.task_states.insert(task_id.clone(), TaskExecutionState {
            task_id,
            current_terminal_index: 0,
            total_terminals: terminal_count,
            completed_terminals: Vec::new(),
            failed_terminals: Vec::new(),
            is_completed: false,
        });
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
            let system_msgs: Vec<_> = self.conversation_history
                .iter()
                .filter(|m| m.role == "system")
                .cloned()
                .collect();
            let recent: Vec<_> = self.conversation_history
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
        self.task_states.values().any(|s| !s.failed_terminals.is_empty())
    }
}

/// 线程安全的状态包装
pub type SharedOrchestratorState = std::sync::Arc<RwLock<OrchestratorState>>;
```

---

**Step 3.1.4: 创建 mod.rs**

文件路径: `vibe-kanban-main/crates/services/src/services/orchestrator/mod.rs`

```rust
//! Orchestrator 主 Agent 模块
//!
//! 负责协调多个 AI 编码代理完成软件开发任务。

pub mod config;
pub mod state;
pub mod types;

// 后续任务中添加
// pub mod llm;
// pub mod message_bus;
// pub mod agent;

pub use config::OrchestratorConfig;
pub use state::{OrchestratorState, OrchestratorRunState, SharedOrchestratorState};
pub use types::*;
```

---

**Step 3.1.5: 更新 services/mod.rs**

在 `vibe-kanban-main/crates/services/src/services/mod.rs` 中添加：

```rust
pub mod orchestrator;
pub use orchestrator::{OrchestratorConfig, OrchestratorState};
```

---

**交付物:**
- `orchestrator/mod.rs`
- `orchestrator/config.rs`
- `orchestrator/state.rs`
- `orchestrator/types.rs`

**验收标准:**
1. 编译通过：`cargo build -p services`
2. 类型定义完整，可以序列化/反序列化

**测试命令:**
```bash
cd F:\Project\GitCortex\vibe-kanban-main
cargo build -p services
```

---

### Task 3.2: 实现 LLM 客户端抽象

**状态:** ⬜ 未开始

**前置条件:**
- Task 3.1 已完成

**目标:**
实现统一的 LLM 客户端接口，支持 OpenAI 兼容 API。

**涉及文件:**
- 创建: `vibe-kanban-main/crates/services/src/services/orchestrator/llm.rs`
- 修改: `vibe-kanban-main/crates/services/src/services/orchestrator/mod.rs`

---

**Step 3.2.1: 创建 llm.rs**

文件路径: `vibe-kanban-main/crates/services/src/services/orchestrator/llm.rs`

```rust
//! LLM 客户端抽象

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use super::config::OrchestratorConfig;
use super::types::{LLMMessage, LLMResponse, LLMUsage};

#[async_trait]
pub trait LLMClient: Send + Sync {
    async fn chat(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse>;
}

pub struct OpenAICompatibleClient {
    client: Client,
    base_url: String,
    api_key: String,
    model: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: Option<f32>,
    max_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    usage: Option<UsageInfo>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct UsageInfo {
    prompt_tokens: i32,
    completion_tokens: i32,
    total_tokens: i32,
}

impl OpenAICompatibleClient {
    pub fn new(config: &OrchestratorConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: config.base_url.trim_end_matches('/').to_string(),
            api_key: config.api_key.clone(),
            model: config.model.clone(),
        }
    }
}

#[async_trait]
impl LLMClient for OpenAICompatibleClient {
    async fn chat(&self, messages: Vec<LLMMessage>) -> anyhow::Result<LLMResponse> {
        let url = format!("{}/chat/completions", self.base_url);

        let chat_messages: Vec<ChatMessage> = messages
            .into_iter()
            .map(|m| ChatMessage { role: m.role, content: m.content })
            .collect();

        let request = ChatRequest {
            model: self.model.clone(),
            messages: chat_messages,
            temperature: Some(0.7),
            max_tokens: Some(4096),
        };

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("LLM API error: {} - {}", status, body));
        }

        let chat_response: ChatResponse = response.json().await?;
        let content = chat_response.choices.first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        let usage = chat_response.usage.map(|u| LLMUsage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
        });

        Ok(LLMResponse { content, usage })
    }
}

pub fn create_llm_client(config: &OrchestratorConfig) -> anyhow::Result<Box<dyn LLMClient>> {
    config.validate().map_err(|e| anyhow::anyhow!(e))?;
    Ok(Box::new(OpenAICompatibleClient::new(config)))
}
```

**交付物:** `orchestrator/llm.rs`

---

### Task 3.3: 实现消息总线

**状态:** ⬜ 未开始

**前置条件:** Task 3.2 已完成

**涉及文件:**
- 创建: `vibe-kanban-main/crates/services/src/services/orchestrator/message_bus.rs`

---

**Step 3.3.1: 创建 message_bus.rs**

```rust
//! 消息总线

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock, broadcast};
use super::types::*;

#[derive(Debug, Clone)]
pub enum BusMessage {
    TerminalCompleted(TerminalCompletionEvent),
    GitEvent { workflow_id: String, commit_hash: String, branch: String, message: String },
    Instruction(OrchestratorInstruction),
    StatusUpdate { workflow_id: String, status: String },
    Error { workflow_id: String, error: String },
    Shutdown,
}

pub struct MessageBus {
    broadcast_tx: broadcast::Sender<BusMessage>,
    subscribers: Arc<RwLock<HashMap<String, Vec<mpsc::Sender<BusMessage>>>>>,
}

impl MessageBus {
    pub fn new(capacity: usize) -> Self {
        let (broadcast_tx, _) = broadcast::channel(capacity);
        Self { broadcast_tx, subscribers: Arc::new(RwLock::new(HashMap::new())) }
    }

    pub fn broadcast(&self, message: BusMessage) -> Result<usize, broadcast::error::SendError<BusMessage>> {
        self.broadcast_tx.send(message)
    }

    pub fn subscribe_broadcast(&self) -> broadcast::Receiver<BusMessage> {
        self.broadcast_tx.subscribe()
    }

    pub async fn subscribe(&self, topic: &str) -> mpsc::Receiver<BusMessage> {
        let (tx, rx) = mpsc::channel(100);
        let mut subscribers = self.subscribers.write().await;
        subscribers.entry(topic.to_string()).or_default().push(tx);
        rx
    }

    pub async fn publish(&self, topic: &str, message: BusMessage) {
        let subscribers = self.subscribers.read().await;
        if let Some(subs) = subscribers.get(topic) {
            for tx in subs { let _ = tx.send(message.clone()).await; }
        }
    }

    pub async fn publish_terminal_completed(&self, event: TerminalCompletionEvent) {
        let topic = format!("workflow:{}", event.workflow_id);
        self.publish(&topic, BusMessage::TerminalCompleted(event.clone())).await;
        let _ = self.broadcast(BusMessage::TerminalCompleted(event));
    }
}

impl Default for MessageBus {
    fn default() -> Self { Self::new(1000) }
}

pub type SharedMessageBus = Arc<MessageBus>;
```

**交付物:** `orchestrator/message_bus.rs`

---

### Task 3.4: 实现 OrchestratorAgent

**状态:** ⬜ 未开始

**前置条件:** Task 3.3 已完成

**涉及文件:**
- 创建: `vibe-kanban-main/crates/services/src/services/orchestrator/agent.rs`

---

**Step 3.4.1: 创建 agent.rs**

```rust
//! Orchestrator Agent 主逻辑

use std::sync::Arc;
use tokio::sync::RwLock;
use db::DBService;
use super::config::OrchestratorConfig;
use super::state::{OrchestratorState, OrchestratorRunState, SharedOrchestratorState};
use super::llm::{LLMClient, create_llm_client};
use super::message_bus::{MessageBus, BusMessage, SharedMessageBus};
use super::types::*;

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

        Ok(Self { config, state, message_bus, llm_client, db })
    }

    /// 启动 Agent 事件循环
    pub async fn run(&self) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        let mut rx = self.message_bus.subscribe(&format!("workflow:{}", workflow_id)).await;
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
            if should_stop { break; }
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
            BusMessage::GitEvent { workflow_id, commit_hash, branch, message } => {
                self.handle_git_event(&workflow_id, &commit_hash, &branch, &message).await?;
            }
            BusMessage::Shutdown => {
                return Ok(true);
            }
            _ => {}
        }
        Ok(false)
    }

    /// 处理终端完成事件
    async fn handle_terminal_completed(&self, event: TerminalCompletionEvent) -> anyhow::Result<()> {
        tracing::info!("Terminal completed: {} with status {:?}", event.terminal_id, event.status);

        // 更新状态
        {
            let mut state = self.state.write().await;
            state.run_state = OrchestratorRunState::Processing;
            let success = matches!(event.status, TerminalCompletionStatus::Completed | TerminalCompletionStatus::ReviewPass);
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
        tracing::info!("Git event: {} on branch {} - {}", commit_hash, branch, message);
        // Git 事件通常会转换为 TerminalCompleted 事件
        Ok(())
    }

    /// 构建完成提示
    async fn build_completion_prompt(&self, event: &TerminalCompletionEvent) -> String {
        format!(
            "终端 {} 已完成任务。\n状态: {:?}\n提交: {:?}\n消息: {:?}\n\n请决定下一步操作。",
            event.terminal_id,
            event.status,
            event.commit_hash,
            event.commit_message
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
    async fn execute_instruction(&self, response: &str) -> anyhow::Result<()> {
        // 尝试解析 JSON 指令
        if let Ok(instruction) = serde_json::from_str::<OrchestratorInstruction>(response) {
            match instruction {
                OrchestratorInstruction::SendToTerminal { terminal_id, message } => {
                    tracing::info!("Sending to terminal {}: {}", terminal_id, message);
                    // TODO: 实际发送到终端
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
```

**交付物:** `orchestrator/agent.rs`

**验收标准:**
1. 编译通过：`cargo build -p services`
2. OrchestratorAgent 可以实例化并运行

---

### Phase 3 单元测试用例

> 在 `vibe-kanban-main/crates/services/src/services/orchestrator/tests.rs` 创建以下测试

```rust
//! Orchestrator 单元测试
//!
//! 测试 LLM 客户端、消息总线、Agent 核心功能

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::sync::mpsc;
    use wiremock::{MockServer, Mock, ResponseTemplate};
    use wiremock::matchers::{method, path, body_json_schema};

    // =========================================================================
    // 测试 1: LLM 客户端 - 基本请求
    // =========================================================================
    #[tokio::test]
    async fn test_llm_client_basic_request() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "Hello! How can I help you?"
                    }
                }]
            })))
            .mount(&mock_server)
            .await;

        let client = LlmClient::new(&mock_server.uri(), "test-key");
        let response = client.chat(&[
            ChatMessage::user("Hello")
        ]).await.unwrap();

        assert!(response.content.contains("Hello"));
    }

    // =========================================================================
    // 测试 2: LLM 客户端 - 流式响应
    // =========================================================================
    #[tokio::test]
    async fn test_llm_client_streaming() {
        let mock_server = MockServer::start().await;

        // 模拟 SSE 流式响应
        let sse_body = r#"data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"content":" world"}}]}

data: [DONE]
"#;

        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .respond_with(ResponseTemplate::new(200)
                .set_body_string(sse_body)
                .insert_header("content-type", "text/event-stream"))
            .mount(&mock_server)
            .await;

        let client = LlmClient::new(&mock_server.uri(), "test-key");
        let mut stream = client.chat_stream(&[
            ChatMessage::user("Hello")
        ]).await.unwrap();

        let mut full_response = String::new();
        while let Some(chunk) = stream.next().await {
            full_response.push_str(&chunk.unwrap());
        }

        assert_eq!(full_response, "Hello world");
    }

    // =========================================================================
    // 测试 3: 消息总线 - 订阅和发布
    // =========================================================================
    #[tokio::test]
    async fn test_message_bus_pubsub() {
        let bus = MessageBus::new();

        let mut subscriber = bus.subscribe("terminal:T1").await;

        bus.publish("terminal:T1", BusMessage::Text("Hello T1".to_string())).await;

        let msg = tokio::time::timeout(
            std::time::Duration::from_secs(1),
            subscriber.recv()
        ).await.unwrap().unwrap();

        assert!(matches!(msg, BusMessage::Text(s) if s == "Hello T1"));
    }

    // =========================================================================
    // 测试 4: 消息总线 - 主题隔离
    // =========================================================================
    #[tokio::test]
    async fn test_message_bus_topic_isolation() {
        let bus = MessageBus::new();

        let mut sub_t1 = bus.subscribe("terminal:T1").await;
        let mut sub_t2 = bus.subscribe("terminal:T2").await;

        bus.publish("terminal:T1", BusMessage::Text("For T1 only".to_string())).await;

        // T1 应该收到
        let msg = tokio::time::timeout(
            std::time::Duration::from_millis(100),
            sub_t1.recv()
        ).await;
        assert!(msg.is_ok());

        // T2 不应该收到
        let msg = tokio::time::timeout(
            std::time::Duration::from_millis(100),
            sub_t2.recv()
        ).await;
        assert!(msg.is_err()); // 超时
    }

    // =========================================================================
    // 测试 5: OrchestratorAgent - 处理 Git 事件
    // =========================================================================
    #[tokio::test]
    async fn test_orchestrator_handle_git_event() {
        let (msg_tx, msg_rx) = mpsc::channel(10);
        let mock_llm = MockLlmClient::new();

        let agent = OrchestratorAgent::new(mock_llm, msg_tx);

        let event = OrchestratorMessage::GitCommitDetected {
            branch: "feature/login".to_string(),
            commit: "abc123".to_string(),
            parsed_commit: ParsedCommit {
                status: Some(TaskStatus::Completed),
                terminal_id: Some("T1".to_string()),
                ..Default::default()
            },
        };

        agent.handle_message(event).await.unwrap();

        // 验证处理逻辑被触发
        assert!(agent.get_terminal_status("T1").await.is_some());
    }

    // =========================================================================
    // 测试 6: OrchestratorAgent - 任务分配
    // =========================================================================
    #[tokio::test]
    async fn test_orchestrator_task_assignment() {
        let (msg_tx, mut msg_rx) = mpsc::channel(10);
        let mock_llm = MockLlmClient::with_response(
            "Based on the analysis, Terminal T2 should handle the database migration."
        );

        let agent = OrchestratorAgent::new(mock_llm, msg_tx);

        // 模拟工作流配置
        let workflow = WorkflowConfig {
            tasks: vec![
                TaskConfig { id: "task-1".into(), name: "Backend API".into(), terminals: vec!["T1".into()] },
                TaskConfig { id: "task-2".into(), name: "Database".into(), terminals: vec!["T2".into()] },
            ],
            ..Default::default()
        };

        agent.start_workflow(workflow).await.unwrap();

        // 验证任务被分配
        let msg = msg_rx.recv().await.unwrap();
        assert!(matches!(msg, BusMessage::TaskAssigned { .. }));
    }

    // =========================================================================
    // 测试 7: OrchestratorAgent - 错误处理
    // =========================================================================
    #[tokio::test]
    async fn test_orchestrator_error_handling() {
        let (msg_tx, mut msg_rx) = mpsc::channel(10);
        let mock_llm = MockLlmClient::new();

        let mut agent = OrchestratorAgent::new(mock_llm, msg_tx);
        agent.set_error_terminal("T-ERR".to_string());

        let event = OrchestratorMessage::TerminalError {
            terminal_id: "T1".to_string(),
            error: "Connection refused".to_string(),
        };

        agent.handle_message(event).await.unwrap();

        // 验证错误被路由到错误终端
        let msg = msg_rx.recv().await.unwrap();
        match msg {
            BusMessage::ErrorReport { target_terminal, .. } => {
                assert_eq!(target_terminal, "T-ERR");
            }
            _ => panic!("Expected ErrorReport message"),
        }
    }

    // =========================================================================
    // 测试 8: LLM 客户端 - 重试机制
    // =========================================================================
    #[tokio::test]
    async fn test_llm_client_retry() {
        let mock_server = MockServer::start().await;

        // 前两次返回 500，第三次成功
        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .respond_with(ResponseTemplate::new(500))
            .up_to_n_times(2)
            .mount(&mock_server)
            .await;

        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "choices": [{"message": {"content": "Success after retry"}}]
            })))
            .mount(&mock_server)
            .await;

        let client = LlmClient::new(&mock_server.uri(), "test-key")
            .with_retry(3, std::time::Duration::from_millis(10));

        let response = client.chat(&[ChatMessage::user("Test")]).await.unwrap();
        assert!(response.content.contains("Success"));
    }
}
```

**运行测试:**
```bash
cd F:\Project\GitCortex\vibe-kanban-main
cargo test -p services orchestrator -- --nocapture
```

---

## Phase 3 完成检查清单

- [ ] Task 3.1: Orchestrator 模块结构创建完成
- [ ] Task 3.2: LLM 客户端实现完成
- [ ] Task 3.3: 消息总线实现完成
- [ ] Task 3.4: OrchestratorAgent 实现完成

---
