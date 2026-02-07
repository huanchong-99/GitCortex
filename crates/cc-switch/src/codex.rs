//! Codex 配置管理
//!
//! Codex 使用两个配置文件：
//! - ~/.codex/auth.json - API 认证信息
//! - ~/.codex/config.toml - 模型和提供商配置

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    atomic_write::{atomic_write_json, atomic_write_text},
    config_path::{ensure_parent_dir_exists, get_codex_auth_path, get_codex_config_path},
    error::{CCSwitchError, Result},
};

/// Codex 认证配置 (auth.json)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodexAuthConfig {
    /// OpenAI API Key
    #[serde(rename = "OPENAI_API_KEY", skip_serializing_if = "Option::is_none")]
    pub openai_api_key: Option<String>,

    /// 其他字段
    #[serde(flatten)]
    pub other: std::collections::HashMap<String, Value>,
}

/// Codex 模型配置 (config.toml)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodexModelConfig {
    /// 模型提供商
    pub model_provider: Option<String>,

    /// 模型名称
    pub model: Option<String>,

    /// 提供商配置
    #[serde(default)]
    pub model_providers: std::collections::HashMap<String, CodexProviderConfig>,
}

/// Codex 提供商配置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CodexProviderConfig {
    /// Base URL
    pub base_url: Option<String>,
}

/// 读取 Codex 认证配置
pub async fn read_codex_auth() -> Result<CodexAuthConfig> {
    let path = get_codex_auth_path()?;
    if !path.exists() {
        return Ok(CodexAuthConfig::default());
    }
    let content = tokio::fs::read_to_string(&path).await?;
    let config: CodexAuthConfig = serde_json::from_str(&content)?;
    Ok(config)
}

/// 写入 Codex 认证配置
pub async fn write_codex_auth(config: &CodexAuthConfig) -> Result<()> {
    let path = get_codex_auth_path()?;
    ensure_parent_dir_exists(&path).await?;
    atomic_write_json(&path, config).await
}

/// 读取 Codex 模型配置
pub async fn read_codex_config() -> Result<CodexModelConfig> {
    let path = get_codex_config_path()?;
    if !path.exists() {
        return Ok(CodexModelConfig::default());
    }
    let content = tokio::fs::read_to_string(&path).await?;
    let config: CodexModelConfig = toml::from_str(&content)?;
    Ok(config)
}

/// 写入 Codex 模型配置
pub async fn write_codex_config(config: &CodexModelConfig) -> Result<()> {
    let path = get_codex_config_path()?;
    ensure_parent_dir_exists(&path).await?;
    let toml_str = toml::to_string_pretty(config).map_err(|e| CCSwitchError::InvalidConfig {
        message: e.to_string(),
    })?;
    atomic_write_text(&path, &toml_str).await
}

/// 更新 Codex 模型配置
pub async fn update_codex_model(base_url: Option<&str>, api_key: &str, model: &str) -> Result<()> {
    // 更新 auth.json
    let mut auth = read_codex_auth().await?;
    auth.openai_api_key = Some(api_key.to_string());
    write_codex_auth(&auth).await?;

    // 更新 config.toml
    let mut config = read_codex_config().await?;
    config.model = Some(model.to_string());

    if let Some(url) = base_url {
        config.model_provider = Some("custom".to_string());
        config.model_providers.insert(
            "custom".to_string(),
            CodexProviderConfig {
                base_url: Some(url.to_string()),
            },
        );
    } else {
        config.model_provider = Some("openai".to_string());
    }

    write_codex_config(&config).await
}
