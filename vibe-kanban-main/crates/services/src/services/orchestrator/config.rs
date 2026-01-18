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
"#
    .to_string()
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
