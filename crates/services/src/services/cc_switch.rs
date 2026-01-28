//! CC-Switch 服务
//!
//! 封装 cc-switch crate，提供与 vibe-kanban 集成的接口。

use std::sync::Arc;
use async_trait::async_trait;

use cc_switch::{CliType as CcCliType, ModelSwitcher, SwitchConfig};
use db::{
    DBService,
    models::{CliType, ModelConfig, Terminal},
};

/// CC-Switch trait for dependency injection and testing
#[async_trait]
pub trait CCSwitch: Send + Sync {
    /// Switch model configuration for a terminal
    async fn switch_for_terminal(
        &self,
        terminal: &Terminal,
    ) -> anyhow::Result<()>;
}

/// CC-Switch 服务
pub struct CCSwitchService {
    db: Arc<DBService>,
    switcher: ModelSwitcher,
}

impl CCSwitchService {
    pub fn new(db: Arc<DBService>) -> Self {
        Self {
            db,
            switcher: ModelSwitcher::new(),
        }
    }
}

#[async_trait]
impl CCSwitch for CCSwitchService {
    /// 为终端切换模型
    ///
    /// 根据终端配置切换对应 CLI 的模型。
    async fn switch_for_terminal(&self, terminal: &Terminal) -> anyhow::Result<()> {
        // 获取 CLI 类型信息
        let cli_type = CliType::find_by_id(&self.db.pool, &terminal.cli_type_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("CLI type not found: {}", terminal.cli_type_id))?;

        // 获取模型配置
        let model_config = ModelConfig::find_by_id(&self.db.pool, &terminal.model_config_id)
            .await?
            .ok_or_else(|| {
                anyhow::anyhow!("Model config not found: {}", terminal.model_config_id)
            })?;

        // 解析 CLI 类型
        let cli = CcCliType::parse(&cli_type.name)
            .ok_or_else(|| anyhow::anyhow!("Unsupported CLI: {}", cli_type.name))?;

        // 解密并获取 API key
        let api_key = terminal
            .get_custom_api_key()?
            .ok_or_else(|| anyhow::anyhow!("API key not configured for terminal"))?;

        // 构建切换配置
        let config = SwitchConfig {
            base_url: terminal.custom_base_url.clone(),
            api_key,
            model: model_config
                .api_model_id
                .clone()
                .unwrap_or_else(|| model_config.name.clone()),
        };

        // 执行切换
        self.switcher.switch(cli, &config).await?;

        tracing::info!(
            "Switched model for terminal {}: cli={}, model={}",
            terminal.id,
            cli_type.display_name,
            model_config.display_name
        );

        Ok(())
    }
}

impl CCSwitchService {
    /// Batch switch models for workflow startup
    ///
    /// Switches model configuration for all terminals in sequence.
    pub async fn switch_for_terminals(&self, terminals: &[Terminal]) -> anyhow::Result<()> {
        for terminal in terminals {
            self.switch_for_terminal(terminal).await?;
        }
        Ok(())
    }

    /// Detect CLI installation status
    pub async fn detect_cli(&self, cli_name: &str) -> anyhow::Result<bool> {
        use tokio::process::Command;

        let cli_type = CliType::find_by_name(&self.db.pool, cli_name).await?;

        if let Some(cli) = cli_type {
            let parts: Vec<&str> = cli.detect_command.split_whitespace().collect();
            if parts.is_empty() {
                return Ok(false);
            }

            let result = Command::new(parts[0]).args(&parts[1..]).output().await;

            Ok(result.map(|o| o.status.success()).unwrap_or(false))
        } else {
            Ok(false)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use db::DBService;
    use std::sync::Arc;

    #[tokio::test]
    async fn test_switch_for_terminals_method_exists() {
        let db = Arc::new(DBService::new().await.unwrap());
        let service = CCSwitchService::new(db);

        // Verify method exists (compile-time check)
        let terminals: Vec<db::models::Terminal> = vec![];
        let _ = service.switch_for_terminals(&terminals).await;
    }

    #[tokio::test]
    async fn test_detect_cli_method_exists() {
        let db = Arc::new(DBService::new().await.unwrap());
        let service = CCSwitchService::new(db);

        // Verify method exists (compile-time check)
        let _ = service.detect_cli("cursor").await;
    }
}
