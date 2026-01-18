//! Orchestrator 主 Agent 模块
//!
//! 负责协调多个 AI 编码代理完成软件开发任务。

pub mod agent;
pub mod config;
pub mod llm;
pub mod message_bus;
pub mod state;
pub mod types;

pub use agent::OrchestratorAgent;
pub use config::OrchestratorConfig;
pub use llm::{LLMClient, OpenAICompatibleClient, create_llm_client};
pub use message_bus::{BusMessage, MessageBus, SharedMessageBus};
pub use state::{OrchestratorRunState, OrchestratorState, SharedOrchestratorState};
pub use types::*;

#[cfg(test)]
mod tests;
