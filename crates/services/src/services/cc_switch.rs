//! CC-Switch 服务
//!
//! 封装 cc-switch crate，提供与 gitcortex 集成的接口。
//!
//! ## 进程隔离架构 (Phase 23)
//!
//! 新增 `build_launch_config` 方法实现进程级别的配置隔离：
//! - 通过环境变量注入配置，而非修改全局配置文件
//! - 支持多工作流并发运行，配置互不干扰
//! - 用户全局配置保持不变

use std::{path::Path, sync::Arc};
use async_trait::async_trait;

use cc_switch::{CliType as CcCliType, ModelSwitcher, SwitchConfig, read_claude_config};
use db::{
    DBService,
    models::{CliType, ModelConfig, Terminal},
};

use crate::services::terminal::process::{SpawnCommand, SpawnEnv};

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
    ///
    /// # Deprecated
    ///
    /// This method modifies global configuration files. Use `build_launch_config` instead
    /// for process-level isolation.
    #[allow(deprecated)]
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

        // Resolve API key based on CLI type
        let api_key = match cli {
            CcCliType::ClaudeCode => {
                // For Claude Code: try custom_api_key first, then read from existing config
                if let Some(custom) = terminal.get_custom_api_key()? {
                    custom
                } else {
                    // Try to read from existing Claude config
                    let config = match read_claude_config().await {
                        Ok(cfg) => cfg,
                        Err(e) => {
                            tracing::warn!(
                                "Failed to read Claude config file: {}. Will check for auth token anyway.",
                                e
                            );
                            Default::default()
                        }
                    };
                    config.env.auth_token
                        .or(config.env.api_key)
                        .ok_or_else(|| anyhow::anyhow!(
                            "Claude Code auth token not configured. Please login via CLI (claude login) or set terminal custom_api_key"
                        ))?
                }
            }
            _ => {
                // For other CLIs: require custom_api_key
                terminal
                    .get_custom_api_key()?
                    .ok_or_else(|| anyhow::anyhow!("API key not configured for terminal"))?
            }
        };

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
    /// Build spawn configuration for a terminal without modifying global config files.
    ///
    /// This method implements process-level isolation by returning environment variables
    /// and CLI arguments instead of writing to global configuration files.
    ///
    /// # Supported CLIs
    ///
    /// - **Claude Code**: Sets ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_MODEL,
    ///   and ANTHROPIC_DEFAULT_*_MODEL environment variables.
    /// - **Codex**: Sets OPENAI_API_KEY, OPENAI_BASE_URL, CODEX_HOME (temp directory),
    ///   and CLI arguments --model and --config.
    /// - **Gemini**: Sets GOOGLE_GEMINI_BASE_URL, GEMINI_API_KEY, GEMINI_MODEL.
    ///
    /// # Arguments
    ///
    /// * `terminal` - Terminal configuration from database
    /// * `base_command` - CLI command to execute (e.g., "claude", "codex", "gemini")
    /// * `working_dir` - Working directory for the spawned process
    ///
    /// # Returns
    ///
    /// Returns a `SpawnCommand` containing command, args, working_dir, and env configuration.
    /// For unsupported CLIs, returns an empty configuration (does not fail).
    pub async fn build_launch_config(
        &self,
        terminal: &Terminal,
        base_command: &str,
        working_dir: &Path,
    ) -> anyhow::Result<SpawnCommand> {
        // Fetch CLI type information
        let cli_type = CliType::find_by_id(&self.db.pool, &terminal.cli_type_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("CLI type not found: {}", terminal.cli_type_id))?;

        // Helper to create empty config for unsupported CLIs
        let empty_config = || SpawnCommand {
            command: base_command.to_string(),
            args: Vec::new(),
            working_dir: working_dir.to_path_buf(),
            env: SpawnEnv::default(),
        };

        // Parse CLI type
        let cli = match CcCliType::parse(&cli_type.name) {
            Some(cli) => cli,
            None => {
                tracing::warn!(
                    cli_name = %cli_type.name,
                    terminal_id = %terminal.id,
                    "CLI does not support config switching, using empty config"
                );
                return Ok(empty_config());
            }
        };

        // Only Claude Code, Codex, and Gemini support environment-based configuration
        if !matches!(cli, CcCliType::ClaudeCode | CcCliType::Codex | CcCliType::Gemini) {
            tracing::warn!(
                cli_name = %cli_type.name,
                terminal_id = %terminal.id,
                "CLI does not support config switching, using empty config"
            );
            return Ok(empty_config());
        }

        // Fetch model configuration
        let model_config = ModelConfig::find_by_id(&self.db.pool, &terminal.model_config_id)
            .await?
            .ok_or_else(|| {
                anyhow::anyhow!("Model config not found: {}", terminal.model_config_id)
            })?;

        let mut env = SpawnEnv::default();
        let mut args = Vec::new();

        match cli {
            CcCliType::ClaudeCode => {
                // Handle base URL: set if provided, otherwise remove inherited
                if let Some(base_url) = &terminal.custom_base_url {
                    env.set.insert("ANTHROPIC_BASE_URL".to_string(), base_url.clone());
                } else {
                    env.unset.push("ANTHROPIC_BASE_URL".to_string());
                }

                // Prevent inherited API key from parent environment polluting child process
                env.unset.push("ANTHROPIC_API_KEY".to_string());

                // Resolve API key: custom first, then from existing config
                let api_key = if let Some(custom) = terminal.get_custom_api_key()? {
                    custom
                } else {
                    let config = match read_claude_config().await {
                        Ok(cfg) => cfg,
                        Err(e) => {
                            tracing::warn!(
                                error = %e,
                                "Failed to read Claude config file, will check for auth token anyway"
                            );
                            Default::default()
                        }
                    };
                    config.env.auth_token
                        .or(config.env.api_key)
                        .ok_or_else(|| anyhow::anyhow!(
                            "Claude Code auth token not configured. Please login via CLI (claude login) or set terminal custom_api_key"
                        ))?
                };

                env.set.insert("ANTHROPIC_AUTH_TOKEN".to_string(), api_key);

                // Set model for all tiers
                let model = model_config
                    .api_model_id
                    .clone()
                    .unwrap_or_else(|| model_config.name.clone());
                env.set.insert("ANTHROPIC_MODEL".to_string(), model.clone());
                env.set.insert("ANTHROPIC_DEFAULT_HAIKU_MODEL".to_string(), model.clone());
                env.set.insert("ANTHROPIC_DEFAULT_SONNET_MODEL".to_string(), model.clone());
                env.set.insert("ANTHROPIC_DEFAULT_OPUS_MODEL".to_string(), model);

                tracing::debug!(
                    terminal_id = %terminal.id,
                    cli = "claude-code",
                    "Built launch config for Claude Code"
                );
            }
            CcCliType::Codex => {
                // Codex requires API key
                let api_key = terminal
                    .get_custom_api_key()?
                    .ok_or_else(|| anyhow::anyhow!("Codex requires API key"))?;
                env.set.insert("OPENAI_API_KEY".to_string(), api_key);

                // Handle base URL
                if let Some(base_url) = &terminal.custom_base_url {
                    env.set.insert("OPENAI_BASE_URL".to_string(), base_url.clone());
                } else {
                    env.unset.push("OPENAI_BASE_URL".to_string());
                }

                // Create isolated CODEX_HOME directory for this terminal
                // Sanitize terminal ID to prevent path traversal attacks
                let safe_id: String = terminal.id
                    .chars()
                    .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
                    .take(64)
                    .collect();
                let base_dir = std::env::temp_dir().join("gitcortex");
                std::fs::create_dir_all(&base_dir).map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to create CODEX_HOME base directory {}: {e}",
                        base_dir.display()
                    )
                })?;
                let codex_home = base_dir.join(format!("codex-{}", safe_id));
                std::fs::create_dir_all(&codex_home).map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to create CODEX_HOME directory {}: {e}",
                        codex_home.display()
                    )
                })?;

                // Set restrictive permissions on Unix (0o700 = owner read/write/execute only)
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    if let Err(e) = std::fs::set_permissions(
                        &codex_home,
                        std::fs::Permissions::from_mode(0o700),
                    ) {
                        tracing::warn!(
                            terminal_id = %terminal.id,
                            codex_home = %codex_home.display(),
                            error = %e,
                            "Failed to set restrictive permissions on CODEX_HOME"
                        );
                    }
                }

                env.set.insert(
                    "CODEX_HOME".to_string(),
                    codex_home.to_string_lossy().to_string(),
                );

                // CLI arguments (higher priority than config files)
                let model = model_config
                    .api_model_id
                    .clone()
                    .unwrap_or_else(|| model_config.name.clone());
                args.push("--model".to_string());
                args.push(model);
                args.push("--config".to_string());
                args.push("forced_login_method=\"api\"".to_string());

                tracing::debug!(
                    terminal_id = %terminal.id,
                    cli = "codex",
                    codex_home = %codex_home.display(),
                    "Built launch config for Codex"
                );
            }
            CcCliType::Gemini => {
                // Handle base URL
                if let Some(base_url) = &terminal.custom_base_url {
                    env.set.insert("GOOGLE_GEMINI_BASE_URL".to_string(), base_url.clone());
                } else {
                    env.unset.push("GOOGLE_GEMINI_BASE_URL".to_string());
                }

                // Gemini requires API key
                let api_key = terminal
                    .get_custom_api_key()?
                    .ok_or_else(|| anyhow::anyhow!("Gemini requires API key"))?;
                env.set.insert("GEMINI_API_KEY".to_string(), api_key);

                // Set model
                let model = model_config
                    .api_model_id
                    .clone()
                    .unwrap_or_else(|| model_config.name.clone());
                env.set.insert("GEMINI_MODEL".to_string(), model);

                tracing::debug!(
                    terminal_id = %terminal.id,
                    cli = "gemini",
                    "Built launch config for Gemini"
                );
            }
            _ => {
                // Should not reach here due to earlier check, but handle gracefully
                tracing::warn!(
                    cli_name = %cli_type.name,
                    terminal_id = %terminal.id,
                    "CLI does not support config switching, using empty config"
                );
                return Ok(empty_config());
            }
        }

        tracing::info!(
            terminal_id = %terminal.id,
            cli = %cli_type.name,
            model = %model_config.display_name,
            env_vars_count = env.set.len(),
            args_count = args.len(),
            "Built launch config for terminal (process isolation)"
        );

        Ok(SpawnCommand {
            command: base_command.to_string(),
            args,
            working_dir: working_dir.to_path_buf(),
            env,
        })
    }

    /// Batch switch models for workflow startup
    ///
    /// Switches model configuration for all terminals in sequence.
    #[deprecated(since = "0.2.0", note = "Use build_launch_config instead to avoid modifying global config")]
    pub async fn switch_for_terminals(&self, terminals: &[Terminal]) -> anyhow::Result<()> {
        for terminal in terminals {
            #[allow(deprecated)]
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
    use sqlx::sqlite::SqlitePoolOptions;
    use std::sync::Arc;

    // Test helper to create in-memory database
    async fn setup_test_db() -> Arc<DBService> {
        let pool = SqlitePoolOptions::new().connect(":memory:").await.unwrap();

        // Run migrations
        let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let migrations_dir = manifest_dir
            .ancestors()
            .nth(1)
            .unwrap()
            .join("db/migrations");

        sqlx::migrate::Migrator::new(migrations_dir)
            .await
            .unwrap()
            .run(&pool)
            .await
            .unwrap();

        Arc::new(DBService { pool })
    }

    #[tokio::test]
    async fn test_switch_for_terminals_method_exists() {
        let db = setup_test_db().await;
        let service = CCSwitchService::new(db);

        // Verify method exists (compile-time check)
        let terminals: Vec<db::models::Terminal> = vec![];
        let _ = service.switch_for_terminals(&terminals).await;
    }

    #[tokio::test]
    async fn test_detect_cli_method_exists() {
        let db = setup_test_db().await;
        let service = CCSwitchService::new(db);

        // Verify method exists (compile-time check)
        let _ = service.detect_cli("cursor").await;
    }
}
