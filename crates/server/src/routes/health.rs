use axum::{extract::State, http::StatusCode, response::Json};
use db::models::feishu_config::FeishuAppConfig;
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

/// Readiness probe — checks DB connectivity, asset dir, temp dir, and
/// optional Feishu integration health.
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

    // Feishu integration status (non-blocking, does not affect overall readiness)
    let feishu_status = resolve_feishu_health(&deployment).await;

    let ready = db_ok && asset_ok && temp_ok;
    let status = if ready { StatusCode::OK } else { StatusCode::SERVICE_UNAVAILABLE };
    (status, Json(json!({
        "ready": ready,
        "feishu": feishu_status,
    })))
}

/// Resolve Feishu health information for the readiness probe.
///
/// Returns a JSON object with `enabled` and `connection_status` fields.
/// This is informational only and does not gate overall readiness.
async fn resolve_feishu_health(deployment: &DeploymentImpl) -> Value {
    let feature_enabled = std::env::var("GITCORTEX_FEISHU_ENABLED")
        .ok()
        .is_some_and(|v| v.trim().eq_ignore_ascii_case("true") || v.trim() == "1");

    if !feature_enabled {
        return json!({ "enabled": false, "connectionStatus": "disabled" });
    }

    let config = FeishuAppConfig::find_enabled(&deployment.db().pool).await;
    match config {
        Ok(Some(_)) => {
            // TODO: Once FeishuService is in AppState, query actual WS connection status.
            json!({
                "enabled": true,
                "connectionStatus": "disconnected",
            })
        }
        Ok(None) => json!({ "enabled": true, "connectionStatus": "not_configured" }),
        Err(_) => json!({ "enabled": true, "connectionStatus": "unknown" }),
    }
}
