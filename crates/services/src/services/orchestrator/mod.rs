//! Orchestrator 主 Agent 模块
//!
//! 负责协调多个 AI 编码代理完成软件开发任务。

pub mod agent;
pub mod config;
pub mod constants;
pub mod llm;
pub mod message_bus;
pub mod runtime;
pub mod state;
pub mod terminal_coordinator;
pub mod types;

pub use agent::OrchestratorAgent;
pub use config::OrchestratorConfig;
pub use llm::{LLMClient, OpenAICompatibleClient, create_llm_client, build_terminal_completion_prompt};
#[cfg(test)]
pub use llm::MockLLMClient;
pub use message_bus::{BusMessage, MessageBus, SharedMessageBus};
pub use runtime::{OrchestratorRuntime, RuntimeConfig};
pub use state::{OrchestratorRunState, OrchestratorState, SharedOrchestratorState};
pub use terminal_coordinator::TerminalCoordinator;
pub use types::*;

#[cfg(test)]
mod tests;

#[cfg(test)]
mod terminal_coordinator_test;

#[cfg(test)]
mod tests;
