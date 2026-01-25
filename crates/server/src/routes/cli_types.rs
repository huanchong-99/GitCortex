//! CLI Type API Routes

use axum::{
    extract::{Path, State},
    routing::get,
    Router,
    response::Json as ResponseJson,
};
use db::models::{CliType, ModelConfig, CliDetectionStatus, CliType as CliTypeModel};
use deployment::Deployment;
use crate::{error::ApiError, DeploymentImpl};
use services::terminal::detector::CliDetector;
use std::sync::Arc;

/// Create CLI types router
pub fn cli_types_routes() -> Router<DeploymentImpl> {
    Router::new()
        .route("/", get(list_cli_types))
        .route("/detect", get(detect_cli_types))
        .route("/:cli_type_id/models", get(list_models_for_cli))
}

/// GET /api/cli_types
/// List all CLI types
async fn list_cli_types(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<Vec<CliType>>, ApiError> {
    let cli_types = CliTypeModel::find_all(&deployment.db().pool).await?;
    Ok(ResponseJson(cli_types))
}

/// GET /api/cli_types/detect
/// Detect installed CLIs
async fn detect_cli_types(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<Vec<CliDetectionStatus>>, ApiError> {
    let db = Arc::new(deployment.db());
    let detector = CliDetector::new(db);

    let results = detector.detect_all().await
        .map_err(|e| ApiError::Internal(format!("Failed to detect CLIs: {}", e)))?;

    Ok(ResponseJson(results))
}

/// GET /api/cli_types/:cli_type_id/models
/// List models for a CLI type
async fn list_models_for_cli(
    State(deployment): State<DeploymentImpl>,
    Path(cli_type_id): Path<String>,
) -> Result<ResponseJson<Vec<ModelConfig>>, ApiError> {
    let models = ModelConfig::find_by_cli_type(&deployment.db().pool, &cli_type_id).await?;
    Ok(ResponseJson(models))
}
