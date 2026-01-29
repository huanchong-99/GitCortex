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
use services::services::terminal::process::ProcessManager;
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

/// Stop terminal endpoint
///
/// POST /api/terminals/:id/stop
///
/// Stops a running terminal by updating its status to 'cancelled' and killing the process
pub async fn stop_terminal(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<String>>, ApiError> {
    // Fetch terminal from database
    let terminal = Terminal::find_by_id(&deployment.db().pool, &id)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("Terminal {id} not found")))?;

    // Check if terminal has a process_id
    let process_id = terminal.process_id.ok_or_else(|| {
        ApiError::BadRequest(format!("Terminal {id} has no associated process"))
    })?;

    // Kill the process using ProcessManager
    let process_manager = ProcessManager::new();
    process_manager
        .kill(process_id as u32)
        .map_err(|e| ApiError::Internal(format!("Failed to kill process {process_id}: {e}")))?;

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
        .route("/{id}/stop", post(stop_terminal))
}
