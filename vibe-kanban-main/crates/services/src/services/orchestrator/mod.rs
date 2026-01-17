//! Orchestrator 主 Agent 模块
//!
//! 负责协调多个 AI 编码代理完成软件开发任务。

pub mod config;
pub mod state;
pub mod types;
pub mod llm;
pub mod message_bus;
pub mod agent;

pub use config::OrchestratorConfig;
pub use state::{OrchestratorState, OrchestratorRunState, SharedOrchestratorState};
pub use types::*;
pub use llm::{LLMClient, create_llm_client, OpenAICompatibleClient};
pub use message_bus::{MessageBus, SharedMessageBus, BusMessage};

#[cfg(test)]
mod tests;
