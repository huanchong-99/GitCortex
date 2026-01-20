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
    let cli_types = CliTypeModel::find_all(&deployment.db().pool).await?;
    let mut results = Vec::new();

    for cli_type in cli_types {
        let status = detect_single_cli(&cli_type).await;
        results.push(status);
    }

    Ok(ResponseJson(results))
}

/// Detect single CLI
async fn detect_single_cli(cli_type: &CliType) -> CliDetectionStatus {
    use tokio::process::Command;

    // Parse detect command
    let parts: Vec<&str> = cli_type.detect_command.split_whitespace().collect();
    if parts.is_empty() {
        return CliDetectionStatus {
            cli_type_id: cli_type.id.clone(),
            name: cli_type.name.clone(),
            display_name: cli_type.display_name.clone(),
            installed: false,
            version: None,
            executable_path: None,
            install_guide_url: cli_type.install_guide_url.clone(),
        };
    }

    let cmd = parts[0];
    let args = &parts[1..];

    // Execute detect command
    let result = Command::new(cmd)
        .args(args)
        .output()
        .await;

    match result {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .map(|s| s.trim().to_string());

            CliDetectionStatus {
                cli_type_id: cli_type.id.clone(),
                name: cli_type.name.clone(),
                display_name: cli_type.display_name.clone(),
                installed: true,
                version,
                executable_path: None,  // Skip which for now
                install_guide_url: cli_type.install_guide_url.clone(),
            }
        }
        _ => CliDetectionStatus {
            cli_type_id: cli_type.id.clone(),
            name: cli_type.name.clone(),
            display_name: cli_type.display_name.clone(),
            installed: false,
            version: None,
            executable_path: None,
            install_guide_url: cli_type.install_guide_url.clone(),
        },
    }
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
