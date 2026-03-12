use axum::{
    extract::{Path, State},
    response::Json as ResponseJson,
    routing::get,
    Router,
};
use db::models::{quality_issue::QualityIssue, quality_run::QualityRun};
use uuid::Uuid;
use utils::response::ApiResponse;
use deployment::Deployment;

use crate::{DeploymentImpl, error::ApiError};

/// 质量报告 API 路由
pub fn quality_routes() -> Router<DeploymentImpl> {
    Router::new()
        .route("/workflows/:workflow_id/quality", get(get_workflow_quality_runs))
        .route("/terminals/:terminal_id/quality", get(get_terminal_quality_runs))
        .route("/quality-runs/:run_id/issues", get(get_quality_run_issues))
}

/// GET /api/workflows/:workflow_id/quality
async fn get_workflow_quality_runs(
    State(deployment): State<DeploymentImpl>,
    Path(workflow_id_str): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<QualityRun>>>, ApiError> {
    let workflow_id = Uuid::parse_str(&workflow_id_str)
        .map_err(|_| ApiError::BadRequest("Invalid workflow ID format".to_string()))?;

    let runs = QualityRun::find_by_workflow(&deployment.db().pool, workflow_id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to fetch quality runs: {e}")))?;

    Ok(ResponseJson(ApiResponse::success(runs)))
}

/// GET /api/terminals/:terminal_id/quality
async fn get_terminal_quality_runs(
    State(deployment): State<DeploymentImpl>,
    Path(terminal_id_str): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<QualityRun>>>, ApiError> {
    let terminal_id = Uuid::parse_str(&terminal_id_str)
        .map_err(|_| ApiError::BadRequest("Invalid terminal ID format".to_string()))?;

    let runs = QualityRun::find_by_terminal(&deployment.db().pool, terminal_id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to fetch quality runs: {e}")))?;

    Ok(ResponseJson(ApiResponse::success(runs)))
}

/// GET /api/quality-runs/:run_id/issues
async fn get_quality_run_issues(
    State(deployment): State<DeploymentImpl>,
    Path(run_id_str): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<QualityIssue>>>, ApiError> {
    let run_id = Uuid::parse_str(&run_id_str)
        .map_err(|_| ApiError::BadRequest("Invalid run ID format".to_string()))?;

    let issues = QualityIssue::find_by_run(&deployment.db().pool, run_id)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to fetch quality issues: {e}")))?;

    Ok(ResponseJson(ApiResponse::success(issues)))
}
