//! Claude Code 配置管理
//!
//! Claude Code 使用 JSON 格式的配置文件：
//! - ~/.claude/settings.json - 主配置文件

use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    atomic_write::atomic_write_json,
    config_path::{ensure_parent_dir_exists, get_claude_settings_path},
    error::Result,
};

/// Claude Code 配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaudeConfig {
    /// 环境变量配置
    #[serde(default)]
    pub env: ClaudeEnvConfig,

    /// 其他配置（保留原有字段）
    #[serde(flatten)]
    pub other: Value,
}

/// Claude Code 环境变量配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaudeEnvConfig {
    /// API Base URL
    #[serde(rename = "ANTHROPIC_BASE_URL", skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,

    /// API Token
    #[serde(
        rename = "ANTHROPIC_AUTH_TOKEN",
        skip_serializing_if = "Option::is_none"
    )]
    pub auth_token: Option<String>,

    /// API Key (备选)
    #[serde(rename = "ANTHROPIC_API_KEY", skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,

    /// 默认模型
    #[serde(rename = "ANTHROPIC_MODEL", skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,

    /// Haiku 模型
    #[serde(
        rename = "ANTHROPIC_DEFAULT_HAIKU_MODEL",
        skip_serializing_if = "Option::is_none"
    )]
    pub haiku_model: Option<String>,

    /// Sonnet 模型
    #[serde(
        rename = "ANTHROPIC_DEFAULT_SONNET_MODEL",
        skip_serializing_if = "Option::is_none"
    )]
    pub sonnet_model: Option<String>,

    /// Opus 模型
    #[serde(
        rename = "ANTHROPIC_DEFAULT_OPUS_MODEL",
        skip_serializing_if = "Option::is_none"
    )]
    pub opus_model: Option<String>,

    /// 其他环境变量
    #[serde(flatten)]
    pub other: std::collections::HashMap<String, Value>,
}

/// 读取 Claude 配置
pub async fn read_claude_config() -> Result<ClaudeConfig> {
    let path = get_claude_settings_path()?;
    read_claude_config_from(&path).await
}

/// 从指定路径读取 Claude 配置
pub async fn read_claude_config_from(path: &Path) -> Result<ClaudeConfig> {
    if !path.exists() {
        return Ok(ClaudeConfig::default());
    }

    let content = tokio::fs::read_to_string(path).await?;
    let config: ClaudeConfig = serde_json::from_str(&content)?;
    Ok(config)
}

/// 写入 Claude 配置
pub async fn write_claude_config(config: &ClaudeConfig) -> Result<()> {
    let path = get_claude_settings_path()?;
    write_claude_config_to(&path, config).await
}

/// 写入 Claude 配置到指定路径
pub async fn write_claude_config_to(path: &Path, config: &ClaudeConfig) -> Result<()> {
    ensure_parent_dir_exists(path).await?;
    atomic_write_json(path, config).await
}

/// 更新 Claude 模型配置
///
/// # 参数
/// - `base_url`: API Base URL（可选，None 表示使用官方 API）
/// - `api_key`: API Key
/// - `model`: 模型名称
pub async fn update_claude_model(base_url: Option<&str>, api_key: &str, model: &str) -> Result<()> {
    let mut config = read_claude_config().await?;

    config.env.base_url = base_url.map(ToString::to_string);
    config.env.auth_token = Some(api_key.to_string());
    config.env.model = Some(model.to_string());

    write_claude_config(&config).await
}

#[cfg(test)]
mod tests {
    use tempfile::tempdir;

    use super::*;

    #[tokio::test]
    async fn test_read_write_claude_config() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("settings.json");

        let config = ClaudeConfig {
            env: ClaudeEnvConfig {
                base_url: Some("https://api.example.com".to_string()),
                auth_token: Some("sk-test".to_string()),
                model: Some("claude-sonnet".to_string()),
                ..Default::default()
            },
            other: serde_json::json!({}),
        };

        write_claude_config_to(&path, &config).await.unwrap();

        let loaded = read_claude_config_from(&path).await.unwrap();
        assert_eq!(loaded.env.base_url, config.env.base_url);
        assert_eq!(loaded.env.auth_token, config.env.auth_token);
    }
}
