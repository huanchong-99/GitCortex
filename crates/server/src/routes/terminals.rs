//! Terminal Routes
//!
//! API endpoints for terminal management and log retrieval

use axum::{
    extract::{Path, Query, State},
    response::Json as ResponseJson,
    routing::{get, post},
    Router,
};
use db::models::terminal::{Terminal, TerminalLog};
use deployment::Deployment;
use serde::Deserialize;
use services::services::terminal::process::{ProcessManager, DEFAULT_COLS, DEFAULT_ROWS};
use utils::response::ApiResponse;

use crate::{error::ApiError, DeploymentImpl};

/// Query parameters for terminal logs retrieval
#[derive(Debug, Deserialize)]
pub struct TerminalLogsQuery {
    /// Maximum number of logs to return (default: 1000)
    pub limit: Option<i32>,
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
/// Starts a terminal by spawning a PTY process
pub async fn start_terminal(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<serde_json::Value>>, ApiError> {
    // Fetch terminal from database
    let terminal = Terminal::find_by_id(&deployment.db().pool, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Terminal {id} not found")))?;

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
    let shell = match cli_type.name.as_str() {
        "claude-code" => "claude",
        "gemini-cli" => "gemini",
        "codex" => "codex",
        "amp" => "amp",
        "cursor-agent" => "cursor",
        _ => &cli_type.name,
    };

    // Get working directory from workflow task
    let working_dir = get_terminal_working_dir(&deployment, &terminal.workflow_task_id)
        .await
        .unwrap_or_else(|_| std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")));

    // Spawn PTY process
    let handle = deployment
        .process_manager()
        .spawn_pty(&id, shell, &working_dir, DEFAULT_COLS, DEFAULT_ROWS)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to spawn terminal process: {e}")))?;

    // Update terminal status in database
    Terminal::set_started(&deployment.db().pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to update terminal status: {e}")))?;

    let pid = i32::try_from(handle.pid).ok();
    Terminal::update_process(&deployment.db().pool, &id, pid, Some(&handle.session_id))
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to update terminal process info: {e}")))?;

    tracing::info!("Terminal {} started with PID {}", id, handle.pid);

    Ok(ResponseJson(ApiResponse::success(serde_json::json!({
        "terminal_id": id,
        "pid": handle.pid,
        "session_id": handle.session_id,
        "status": "started"
    }))))
}

/// Get working directory for a terminal from its workflow task
async fn get_terminal_working_dir(
    deployment: &DeploymentImpl,
    workflow_task_id: &str,
) -> anyhow::Result<std::path::PathBuf> {
    // Get workflow from workflow_task
    let workflow_id: Option<String> = sqlx::query_scalar(
        "SELECT workflow_id FROM workflow_task WHERE id = ?"
    )
    .bind(workflow_task_id)
    .fetch_optional(&deployment.db().pool)
    .await?
    .flatten();

    if let Some(wf_id) = workflow_id {
        let base_dir: Option<String> = sqlx::query_scalar(
            "SELECT base_dir FROM workflow WHERE id = ?"
        )
        .bind(&wf_id)
        .fetch_optional(&deployment.db().pool)
        .await?
        .flatten();

        if let Some(dir) = base_dir {
            return Ok(std::path::PathBuf::from(dir));
        }
    }

    Err(anyhow::anyhow!("Could not determine working directory"))
}

/// Stop terminal endpoint
///
/// POST /api/terminals/:id/stop
///
/// Stops a running terminal by updating its status to 'cancelled' and killing the process
pub async fn stop_terminal(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<String>>, ApiError> {
    // Kill the terminal using ProcessManager
    deployment
        .process_manager()
        .kill_terminal(&id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to kill terminal {id}: {e}")))?;

    // Update terminal status to 'cancelled'
    Terminal::update_status(&deployment.db().pool, &id, "cancelled").await?;

    tracing::info!("Terminal {} stopped successfully", id);

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
