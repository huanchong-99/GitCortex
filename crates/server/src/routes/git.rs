use axum::{extract::State, response::Json as ResponseJson, routing::post, Router};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use ts_rs::TS;
use utils::response::ApiResponse;

use crate::{error::ApiError, DeploymentImpl};

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct GitStatusRequest {
    pub path: String,
}

#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export, rename_all = "camelCase")]
pub struct GitStatusResponse {
    pub is_git_repo: bool,
    pub is_dirty: bool,
    pub current_branch: Option<String>,
    pub remote_url: Option<String>,
    pub uncommitted_changes: Option<usize>,
}

pub async fn git_status(
    State(deployment): State<DeploymentImpl>,
    ResponseJson(payload): ResponseJson<GitStatusRequest>,
) -> Result<ResponseJson<ApiResponse<GitStatusResponse>>, ApiError> {
    // Normalize path separators for cross-platform compatibility
    let normalized_path = payload.path.replace('\\', "/");
    let repo_path = PathBuf::from(&normalized_path);
    let git = deployment.git();

    if git.open_repo(&repo_path).is_err() {
        return Ok(ResponseJson(ApiResponse::success(GitStatusResponse {
            is_git_repo: false,
            is_dirty: false,
            current_branch: None,
            remote_url: None,
            uncommitted_changes: None,
        })));
    }

    let current_branch = git.get_current_branch(&repo_path).ok();
    let uncommitted_changes = git
        .get_worktree_change_counts(&repo_path)
        .ok()
        .map(|(tracked, untracked)| tracked + untracked);
    let is_dirty = uncommitted_changes.unwrap_or(0) > 0;

    let remote_url = current_branch
        .as_deref()
        .and_then(|branch| git.resolve_remote_name_for_branch(&repo_path, branch).ok())
        .and_then(|remote| git.get_remote_url(&repo_path, &remote).ok());

    Ok(ResponseJson(ApiResponse::success(GitStatusResponse {
        is_git_repo: true,
        is_dirty,
        current_branch,
        remote_url,
        uncommitted_changes,
    })))
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct GitInitRequest {
    pub path: String,
}

pub async fn git_init(
    State(deployment): State<DeploymentImpl>,
    ResponseJson(payload): ResponseJson<GitInitRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    // Normalize path separators for cross-platform compatibility
    let normalized_path = payload.path.replace('\\', "/");
    deployment
        .git()
        .initialize_repo_with_main_branch(std::path::Path::new(&normalized_path))?;
    Ok(ResponseJson(ApiResponse::success(())))
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/git/status", post(git_status))
        .route("/git/init", post(git_init))
}
