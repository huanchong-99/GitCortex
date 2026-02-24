use axum::{extract::State, http::StatusCode, response::Json};
use deployment::Deployment;
use serde_json::{json, Value};
use utils::response::ApiResponse;

use crate::DeploymentImpl;

pub async fn health_check() -> Json<ApiResponse<String>> {
    Json(ApiResponse::success("OK".to_string()))
}

/// Liveness probe — stateless, always returns 200.
pub async fn healthz() -> Json<Value> {
    Json(json!({ "ok": true }))
}

/// Readiness probe — checks DB connectivity, asset dir, and temp dir.
pub async fn readyz(
    State(deployment): State<DeploymentImpl>,
) -> (StatusCode, Json<Value>) {
    let db_ok = sqlx::query("SELECT 1")
        .fetch_one(&deployment.db().pool)
        .await
        .is_ok();
    let asset_ok = utils::assets::asset_dir().map(|p| p.exists()).unwrap_or(false);
    let temp_ok = {
        let dir = utils::path::get_gitcortex_temp_dir();
        std::fs::create_dir_all(&dir).is_ok() && dir.exists()
    };
    let ready = db_ok && asset_ok && temp_ok;
    let status = if ready { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (status, Json(json!({ "ready": ready })))
}
