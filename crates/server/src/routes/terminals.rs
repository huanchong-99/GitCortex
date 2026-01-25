//! Terminal Routes
//!
//! API endpoints for terminal management and log retrieval

use axum::{
    extract::{Path, Query, State},
    response::Json as ResponseJson,
    routing::get,
    Router,
};
use db::models::terminal::TerminalLog;
use serde::Deserialize;
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
) -> Result<ResponseJson<ApiResponse<Vec<TerminalLog>>, ApiError>, ApiError> {
    // Fetch logs from database (already in DESC order by created_at)
    let mut logs = TerminalLog::find_by_terminal(&deployment.db().pool, &id, query.limit).await?;

    // Reverse to get chronological order (oldest first)
    logs.reverse();

    Ok(ResponseJson(ApiResponse::success(logs)))
}

/// Terminal routes router
///
/// Mounts all terminal-related API endpoints
pub fn terminal_routes() -> Router<DeploymentImpl> {
    Router::new().route("/:id/logs", get(get_terminal_logs))
}
