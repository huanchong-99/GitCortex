//! Terminal Routes
//!
//! API endpoints for terminal management and log retrieval

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use db::models::terminal::{Terminal, TerminalLog};
use deployment::Deployment;
use serde::Deserialize;
use services::services::cc_switch::CCSwitchService;
use services::services::terminal::bridge::TerminalBridge;
use services::services::terminal::process::{DEFAULT_COLS, DEFAULT_ROWS};
use tokio::process::Command;
use utils::response::ApiResponse;

use crate::{error::ApiError, DeploymentImpl};

/// Terminal state machine: statuses that can directly transition to starting.
/// For waiting/working, we check if process is actually running first.
const STARTABLE_TERMINAL_STATUSES: [&str; 5] = ["not_started", "failed", "cancelled", "waiting", "working"];

/// Query parameters for terminal logs retrieval
#[derive(Debug, Deserialize)]
pub struct TerminalLogsQuery {
    /// Maximum number of logs to return (default: 1000)
    pub limit: Option<i32>,
}

/// Get extended PATH with common CLI installation directories
#[cfg(windows)]
fn get_extended_path() -> String {
    let current_path = std::env::var("PATH").unwrap_or_default();
    let mut paths: Vec<String> = vec![current_path];

    // Add common npm global paths
    if let Ok(appdata) = std::env::var("APPDATA") {
        paths.push(format!("{}\\npm", appdata));
    }

    // Add user local bin (for tools like claude)
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        paths.push(format!("{}\\.local\\bin", userprofile));
    }

    // Add common program files paths
    if let Ok(programfiles) = std::env::var("ProgramFiles") {
        paths.push(format!("{}\\nodejs", programfiles));
    }

    paths.join(";")
}

#[cfg(not(windows))]
fn get_extended_path() -> String {
    let current_path = std::env::var("PATH").unwrap_or_default();
    let mut paths: Vec<String> = vec![current_path];

    // Add common paths on Unix
    if let Ok(home) = std::env::var("HOME") {
        paths.push(format!("{}/.local/bin", home));
        paths.push(format!("{}/.npm-global/bin", home));
        paths.push(format!("{}/bin", home));
    }

    paths.push("/usr/local/bin".to_string());

    paths.join(":")
}

/// Find executable path for a command
async fn find_executable(cmd: &str) -> Option<String> {
    let extended_path = get_extended_path();

    #[cfg(unix)]
    {
        Command::new("which")
            .arg(cmd)
            .env("PATH", &extended_path)
            .output()
            .await
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    }

    #[cfg(windows)]
    {
        Command::new("where")
            .arg(cmd)
            .env("PATH", &extended_path)
            .output()
            .await
            .ok()
            .filter(|o| o.status.success())
            .map(|o| {
                String::from_utf8_lossy(&o.stdout)
                    .lines()
                    .next()
                    .unwrap_or("")
                    .to_string()
            })
    }
}

/// Get terminal logs endpoint
///
/// GET /api/terminals/:id/logs
///
/// Retrieves all logs for a specific terminal in chronological order
pub async fn get_terminal_logs(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    Query(query): Query<TerminalLogsQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<TerminalLog>>>, ApiError> {
    // Fetch logs from database (already in DESC order by created_at)
    let mut logs = TerminalLog::find_by_terminal(&deployment.db().pool, &id, query.limit).await?;

    // Reverse to get chronological order (oldest first)
    logs.reverse();

    Ok(ResponseJson(ApiResponse::success(logs)))
}

/// Start terminal endpoint
///
/// POST /api/terminals/:id/start
///
/// Starts a terminal by spawning a PTY process with proper configuration
/// including auto-confirm flags and MessageBus bridge registration.
pub async fn start_terminal(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<serde_json::Value>>, ApiError> {
    // Fetch terminal from database
    let terminal = Terminal::find_by_id(&deployment.db().pool, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Terminal {id} not found")))?;

    // Validate terminal status before starting
    if !STARTABLE_TERMINAL_STATUSES.contains(&terminal.status.as_str()) {
        return Err(ApiError::Conflict(format!(
            "Terminal {id} cannot be started from status '{}'",
            terminal.status
        )));
    }

    // Check if terminal is already running
    if deployment.process_manager().is_running(&id).await {
        return Err(ApiError::Conflict(format!("Terminal {id} is already running")));
    }

    // Get CLI type to determine shell command
    let cli_type = db::models::cli_type::CliType::find_by_id(&deployment.db().pool, &terminal.cli_type_id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to fetch CLI type: {e}")))?
        .ok_or_else(|| ApiError::NotFound(format!("CLI type {} not found", terminal.cli_type_id)))?;

    // Determine shell command based on CLI type
    let cmd_name = match cli_type.name.as_str() {
        "claude-code" => "claude",
        "gemini-cli" => "gemini",
        "codex" => "codex",
        "amp" => "amp",
        "cursor-agent" => "cursor",
        _ => &cli_type.name,
    };

    // Find the absolute path of the CLI executable
    let shell = find_executable(cmd_name).await.ok_or_else(|| {
        ApiError::BadRequest(format!(
            "CLI '{}' not found in PATH. Please ensure it is installed and accessible.",
            cmd_name
        ))
    })?;

    tracing::info!("Found CLI executable at: {}", shell);

    // Get working directory from workflow task
    let working_dir = get_terminal_working_dir(&deployment, &terminal.workflow_task_id)
        .await
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")));

    // Transition to starting before spawn
    Terminal::update_status(&deployment.db().pool, &id, "starting")
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to update terminal status: {e}")))?;

    // Build spawn configuration with auto-confirm flags using CCSwitchService
    let cc_switch = CCSwitchService::new(Arc::new(deployment.db().clone()));
    let spawn_config = match cc_switch
        .build_launch_config(&terminal, &shell, &working_dir, terminal.auto_confirm)
        .await
    {
        Ok(config) => config,
        Err(e) => {
            // On config build failure, reset status
            let _ = Terminal::update_status(&deployment.db().pool, &id, "failed").await;
            return Err(ApiError::Internal(format!("Failed to build launch config: {e}")));
        }
    };

    // Spawn PTY process with configuration
    let handle = match deployment
        .process_manager()
        .spawn_pty_with_config(&id, &spawn_config, DEFAULT_COLS, DEFAULT_ROWS)
        .await
    {
        Ok(handle) => handle,
        Err(e) => {
            // On spawn failure, set status to failed
            let _ = Terminal::update_status(&deployment.db().pool, &id, "failed").await;
            let _ = Terminal::update_process(&deployment.db().pool, &id, None, None).await;
            return Err(ApiError::Internal(format!("Failed to spawn terminal process: {e}")));
        }
    };

    // Update terminal status in database
    Terminal::set_started(&deployment.db().pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to update terminal status: {e}")))?;

    let pid = i32::try_from(handle.pid).ok();
    Terminal::update_process(&deployment.db().pool, &id, pid, Some(&handle.session_id))
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to update terminal process info: {e}")))?;

    // Register terminal bridge for MessageBus -> PTY stdin forwarding
    let terminal_bridge = TerminalBridge::new(
        deployment.message_bus().clone(),
        deployment.process_manager().clone(),
    );
    if let Err(e) = terminal_bridge.register(&id, &handle.session_id).await {
        tracing::warn!(
            terminal_id = %id,
            pty_session_id = %handle.session_id,
            error = %e,
            "Failed to register terminal bridge (non-fatal)"
        );
    } else {
        tracing::debug!(
            terminal_id = %id,
            pty_session_id = %handle.session_id,
            "Terminal bridge registered successfully"
        );
    }

    tracing::info!(
        terminal_id = %id,
        pid = handle.pid,
        auto_confirm = terminal.auto_confirm,
        "Terminal started with auto-confirm={}", terminal.auto_confirm
    );

    Ok(ResponseJson(ApiResponse::success(serde_json::json!({
        "terminal_id": id,
        "pid": handle.pid,
        "session_id": handle.session_id,
        "status": "started",
        "auto_confirm": terminal.auto_confirm
    }))))
}

/// Get working directory for a terminal from its workflow task
async fn get_terminal_working_dir(
    deployment: &DeploymentImpl,
    workflow_task_id: &str,
) -> anyhow::Result<std::path::PathBuf> {
    // Get workflow_id from workflow_task
    let workflow_id: Option<String> = sqlx::query_scalar(
        "SELECT workflow_id FROM workflow_task WHERE id = ?"
    )
    .bind(workflow_task_id)
    .fetch_optional(&deployment.db().pool)
    .await?
    .flatten();

    let workflow_id = workflow_id.ok_or_else(|| {
        anyhow::anyhow!("Workflow task {} not found", workflow_task_id)
    })?;

    // Get project_id from workflow
    let project_id: Option<Vec<u8>> = sqlx::query_scalar(
        "SELECT project_id FROM workflow WHERE id = ?"
    )
    .bind(&workflow_id)
    .fetch_optional(&deployment.db().pool)
    .await?
    .flatten();

    let project_id = project_id.ok_or_else(|| {
        anyhow::anyhow!("Workflow {} not found", workflow_id)
    })?;

    // Convert project_id bytes to UUID string
    let project_uuid = uuid::Uuid::from_slice(&project_id)
        .map_err(|e| anyhow::anyhow!("Invalid project_id format: {}", e))?;

    // Get default_agent_working_dir from project
    let working_dir: Option<String> = sqlx::query_scalar(
        "SELECT default_agent_working_dir FROM projects WHERE id = ?"
    )
    .bind(project_uuid)
    .fetch_optional(&deployment.db().pool)
    .await?
    .flatten();

    if let Some(dir) = working_dir {
        if !dir.is_empty() {
            return Ok(std::path::PathBuf::from(dir));
        }
    }

    Err(anyhow::anyhow!("Could not determine working directory: project has no default_agent_working_dir configured"))
}

/// Stop terminal endpoint
///
/// POST /api/terminals/:id/stop
///
/// Stops a running terminal and resets its status to 'not_started' for restart
pub async fn stop_terminal(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<String>>, ApiError> {
    // Best-effort kill in case the process is still running
    if let Err(e) = deployment.process_manager().kill_terminal(&id).await {
        tracing::warn!("Failed to kill terminal {}: {}", id, e);
    }

    // Reset terminal status for restart (not_started allows re-starting)
    Terminal::update_status(&deployment.db().pool, &id, "not_started").await?;
    Terminal::update_process(&deployment.db().pool, &id, None, None).await?;

    tracing::info!("Terminal {} stopped and reset successfully", id);

    Ok(ResponseJson(ApiResponse::success(format!(
        "Terminal {} stopped successfully",
        id
    ))))
}

/// Terminal routes router
///
/// Mounts all terminal-related API endpoints
pub fn terminal_routes() -> Router<DeploymentImpl> {
    Router::new()
        .route("/{id}/logs", get(get_terminal_logs))
        .route("/{id}/start", post(start_terminal))
        .route("/{id}/stop", post(stop_terminal))
}
