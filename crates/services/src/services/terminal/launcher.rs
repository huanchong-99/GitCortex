//! Terminal launcher
//!
//! Serial terminal launcher with model switching integration.

use std::{path::PathBuf, sync::Arc};

// Re-export types
pub use db::models::Terminal;
use db::{DBService, models::{
    cli_type,
    workspace::Workspace,
    session::Session,
    execution_process::{ExecutionProcess, ExecutionProcessRunReason, CreateExecutionProcess},
    task::Task,
    project::Project,
    execution_process_repo_state::CreateExecutionProcessRepoState,
}};
use uuid::Uuid;
use executors::{
    actions::{ExecutorAction, ExecutorActionType, coding_agent_initial::CodingAgentInitialRequest},
    profile::ExecutorProfileId,
    executors::BaseCodingAgent,
};

use super::process::{ProcessHandle, ProcessManager};
use crate::services::cc_switch::CCSwitchService;

/// Terminal launcher for serial terminal startup
pub struct TerminalLauncher {
    db: Arc<DBService>,
    cc_switch: Arc<CCSwitchService>,
    process_manager: Arc<ProcessManager>,
    working_dir: PathBuf,
}

/// Result of a terminal launch operation
#[derive(Debug)]
pub struct LaunchResult {
    pub terminal_id: String,
    pub process_handle: Option<ProcessHandle>,
    pub success: bool,
    pub error: Option<String>,
}

impl TerminalLauncher {
    /// Create a new terminal launcher
    ///
    /// # Arguments
    /// * `db` - Database service
    /// * `cc_switch` - CC switch service for model switching
    /// * `process_manager` - Process manager for lifecycle management
    /// * `working_dir` - Working directory for spawned processes
    pub fn new(
        db: Arc<DBService>,
        cc_switch: Arc<CCSwitchService>,
        process_manager: Arc<ProcessManager>,
        working_dir: PathBuf,
    ) -> Self {
        Self {
            db,
            cc_switch,
            process_manager,
            working_dir,
        }
    }

    /// Launch all terminals for a workflow (serial execution)
    ///
    /// # Arguments
    /// * `workflow_id` - The workflow ID
    ///
    /// # Returns
    /// A vector of launch results for each terminal
    pub async fn launch_all(&self, workflow_id: &str) -> anyhow::Result<Vec<LaunchResult>> {
        let terminals = Terminal::find_by_workflow(&self.db.pool, workflow_id).await?;
        let mut results = Vec::new();

        tracing::info!(
            "Launching {} terminals for workflow {}",
            terminals.len(),
            workflow_id
        );

        for terminal in terminals {
            let result = self.launch_terminal(&terminal).await;
            results.push(result);

            // Brief delay to ensure environment variable switching takes effect
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        Ok(results)
    }

    /// Launch a single terminal
    ///
    /// # Arguments
    /// * `terminal` - The terminal configuration
    ///
    /// # Returns
    /// A launch result indicating success or failure
    pub async fn launch_terminal(&self, terminal: &Terminal) -> LaunchResult {
        let terminal_id = terminal.id.clone();

        // 1. Switch model configuration
        if let Err(e) = self.cc_switch.switch_for_terminal(terminal).await {
            tracing::error!("Failed to switch model for terminal {}: {}", terminal_id, e);
            return LaunchResult {
                terminal_id,
                process_handle: None,
                success: false,
                error: Some(format!("Model switch failed: {e}")),
            };
        }

        // 2. Get CLI type information
        let cli_type =
            match cli_type::CliType::find_by_id(&self.db.pool, &terminal.cli_type_id).await {
                Ok(Some(cli)) => cli,
                Ok(None) => {
                    return LaunchResult {
                        terminal_id,
                        process_handle: None,
                        success: false,
                        error: Some("CLI type not found".to_string()),
                    };
                }
                Err(e) => {
                    return LaunchResult {
                        terminal_id,
                        process_handle: None,
                        success: false,
                        error: Some(format!("Database error: {e}")),
                    };
                }
            };

        // 3. Create Session for execution context tracking
        // Get workflow task to find associated workspace
        let workspace_id = match self.get_workspace_for_terminal(&terminal.workflow_task_id).await {
            Ok(Some(id)) => Some(id),
            Ok(None) => {
                tracing::warn!("No workspace found for terminal {}", terminal_id);
                None
            }
            Err(e) => {
                tracing::error!("Failed to get workspace for terminal {}: {}", terminal_id, e);
                None
            }
        };

        let (session_id, execution_process_id) = if let Some(ws_id) = workspace_id {
            match Session::create_for_terminal(&self.db.pool, ws_id, Some("claude-code".to_string()), Some(terminal_id.clone())).await {
                Ok(session) => {
                    tracing::info!("Created session {} for terminal {}", session.id, terminal_id);

                    // Create ExecutionProcess for tracking this terminal launch
                    // Create a simple coding agent action
                    let executor_action = ExecutorAction::new(
                        ExecutorActionType::CodingAgentInitialRequest(CodingAgentInitialRequest {
                            prompt: format!("Terminal launched for workflow task: {}", terminal.workflow_task_id),
                            executor_profile_id: ExecutorProfileId::new(BaseCodingAgent::ClaudeCode),
                            working_dir: None,
                        }),
                        None,
                    );

                    let create_exec_process = CreateExecutionProcess {
                        session_id: session.id,
                        executor_action,
                        run_reason: ExecutionProcessRunReason::CodingAgent,
                    };

                    match ExecutionProcess::create(
                        &self.db.pool,
                        &create_exec_process,
                        Uuid::new_v4(),
                        &[], // Empty repo states for terminal launch
                    ).await {
                        Ok(exec_process) => {
                            tracing::info!("Created execution process {} for terminal {}", exec_process.id, terminal_id);
                            (Some(session.id.to_string()), Some(exec_process.id.to_string()))
                        }
                        Err(e) => {
                            tracing::error!("Failed to create execution process for terminal {}: {}", terminal_id, e);
                            (Some(session.id.to_string()), None)
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to create session for terminal {}: {}", terminal_id, e);
                    (None, None)
                }
            }
        } else {
            (None, None)
        };

        // 4. Build launch command
        let cmd = self.build_launch_command(&cli_type.name);

        // 5. Spawn process
        match self
            .process_manager
            .spawn(&terminal_id, cmd, &self.working_dir)
            .await
        {
            Ok(handle) => {
                // Update terminal status in database
                let _ = Terminal::set_started(&self.db.pool, &terminal_id).await;
                let pid = i32::try_from(handle.pid).ok();
                let _ = Terminal::update_process(
                    &self.db.pool,
                    &terminal_id,
                    pid,
                    Some(&handle.session_id),
                )
                .await;

                // Update terminal with session and execution process binding
                if session_id.is_some() || execution_process_id.is_some() {
                    let _ = Terminal::update_session(
                        &self.db.pool,
                        &terminal_id,
                        session_id.as_deref(),
                        execution_process_id.as_deref(),
                    )
                    .await;
                }

                tracing::info!("Terminal {} started with PID {}", terminal_id, handle.pid);

                LaunchResult {
                    terminal_id,
                    process_handle: Some(handle),
                    success: true,
                    error: None,
                }
            }
            Err(e) => {
                tracing::error!("Failed to start terminal {}: {}", terminal_id, e);
                LaunchResult {
                    terminal_id,
                    process_handle: None,
                    success: false,
                    error: Some(format!("Process spawn failed: {e}")),
                }
            }
        }
    }

    /// Build launch command for a CLI type
    ///
    /// # Arguments
    /// * `cli_name` - The CLI name
    ///
    /// # Returns
    /// A configured Command for the CLI
    fn build_launch_command(&self, cli_name: &str) -> tokio::process::Command {
        let mut cmd = match cli_name {
            "claude-code" => {
                let mut c = tokio::process::Command::new("claude");
                c.arg("--dangerously-skip-permissions");
                c
            }
            "gemini-cli" => tokio::process::Command::new("gemini"),
            "codex" => tokio::process::Command::new("codex"),
            "amp" => tokio::process::Command::new("amp"),
            "cursor-agent" => tokio::process::Command::new("cursor"),
            _ => tokio::process::Command::new(cli_name),
        };

        cmd.current_dir(&self.working_dir);
        cmd.kill_on_drop(true);

        cmd
    }

    /// Get workspace ID for a terminal by traversing workflow_task -> task -> workspace
    async fn get_workspace_for_terminal(
        &self,
        workflow_task_id: &str,
    ) -> anyhow::Result<Option<uuid::Uuid>> {
        use sqlx::Row as _;

        // Get vk_task_id from workflow_task
        let task_id: Option<String> = sqlx::query_scalar(
            "SELECT vk_task_id FROM workflow_task WHERE id = ?"
        )
        .bind(workflow_task_id)
        .fetch_optional(&self.db.pool)
        .await?
        .flatten();

        let Some(task_id_str) = task_id else {
            return Ok(None);
        };

        // Parse task_id as UUID
        let task_uuid = uuid::Uuid::parse_str(&task_id_str)?;

        // Get workspace_id from workspace table
        let workspace_id: Option<String> = sqlx::query_scalar(
            "SELECT id FROM workspaces WHERE task_id = ? LIMIT 1"
        )
        .bind(task_uuid)
        .fetch_optional(&self.db.pool)
        .await?
        .flatten();

        match workspace_id {
            Some(ws_id_str) => {
                let ws_uuid = uuid::Uuid::parse_str(&ws_id_str)?;
                Ok(Some(ws_uuid))
            }
            None => Ok(None),
        }
    }

    /// Stop all terminals for a workflow
    ///
    /// # Arguments
    /// * `workflow_id` - The workflow ID
    pub async fn stop_all(&self, workflow_id: &str) -> anyhow::Result<()> {
        let terminals = Terminal::find_by_workflow(&self.db.pool, workflow_id).await?;

        for terminal in terminals {
            if let Some(pid) = terminal.process_id {
                if let Ok(pid_u32) = u32::try_from(pid) {
                    self.process_manager.kill(pid_u32)?;
                } else {
                    tracing::warn!("Skipping invalid process id {pid} for terminal {}", terminal.id);
                }
            }
            Terminal::update_status(&self.db.pool, &terminal.id, "cancelled").await?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test helper - creates launcher with in-memory database
    async fn setup_launcher() -> (TerminalLauncher, Arc<DBService>) {
        use sqlx::{migrate::Migrator, sqlite::SqlitePoolOptions};

        let pool = SqlitePoolOptions::new().connect(":memory:").await.unwrap();

        // Get migrations path: from crates/services/ go to ../db/migrations
        let migrations_path: std::path::PathBuf =
            [env!("CARGO_MANIFEST_DIR"), "..", "db", "migrations"]
                .iter()
                .collect();

        // Manually run migrations
        let m = Migrator::new(migrations_path).await.unwrap();
        m.run(&pool).await.unwrap();

        let db = Arc::new(DBService { pool });
        let cc_switch = Arc::new(CCSwitchService::new(Arc::clone(&db)));
        let process_manager = Arc::new(ProcessManager::new());
        let working_dir = std::env::temp_dir();

        let launcher =
            TerminalLauncher::new(Arc::clone(&db), cc_switch, process_manager, working_dir);

        (launcher, db)
    }

    #[tokio::test]
    async fn test_launcher_new() {
        let (launcher, _) = setup_launcher().await;
        assert!(!launcher.working_dir.to_str().unwrap().is_empty());
    }

    #[tokio::test]
    async fn test_build_launch_command_claude() {
        let (launcher, _) = setup_launcher().await;
        let _cmd = launcher.build_launch_command("claude-code");
        // Verify command was built without panic
    }

    #[tokio::test]
    async fn test_build_launch_command_gemini() {
        let (launcher, _) = setup_launcher().await;
        let _cmd = launcher.build_launch_command("gemini-cli");
    }

    #[tokio::test]
    async fn test_launch_terminal_missing_cli_type() {
        let (launcher, db) = setup_launcher().await;

        // Create a workflow
        let wf_id = uuid::Uuid::new_v4().to_string();
        let _ = sqlx::query(
            "INSERT INTO workflow (id, name, base_dir, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&wf_id)
        .bind("test-wf")
        .bind("/tmp")
        .bind("created")
        .bind(chrono::Utc::now())
        .bind(chrono::Utc::now())
        .execute(&db.pool)
        .await;

        // Create a terminal with non-existent CLI type
        let terminal = Terminal {
            id: "test-term".to_string(),
            workflow_task_id: wf_id.clone(),
            cli_type_id: "non-existent-cli".to_string(),
            model_config_id: uuid::Uuid::new_v4().to_string(),
            custom_base_url: None,
            custom_api_key: None,
            role: None,
            role_description: None,
            order_index: 0,
            status: "not_started".to_string(),
            process_id: None,
            pty_session_id: None,
            session_id: None,
            execution_process_id: None,
            vk_session_id: None,
            last_commit_hash: None,
            last_commit_message: None,
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let result = launcher.launch_terminal(&terminal).await;
        assert!(!result.success);
        assert!(result.error.is_some());
        assert_eq!(result.terminal_id, "test-term");
    }

    #[tokio::test]
    async fn test_launch_result_structure() {
        let result = LaunchResult {
            terminal_id: "test".to_string(),
            process_handle: None,
            success: true,
            error: None,
        };

        assert_eq!(result.terminal_id, "test");
        assert!(result.success);
        assert!(result.process_handle.is_none());
        assert!(result.error.is_none());
    }
}
