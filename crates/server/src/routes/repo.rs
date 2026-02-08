use std::path::{Component, PathBuf};

use axum::{
    Router,
    extract::{Path, Query, State},
    response::Json as ResponseJson,
    routing::{get, post},
};
use db::models::{
    project::SearchResult,
    repo::{Repo, UpdateRepo},
};
use deployment::Deployment;
use serde::Deserialize;
use services::services::{file_search::SearchQuery, git::GitBranch};
use ts_rs::TS;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{
    DeploymentImpl,
    error::ApiError,
    routes::projects::{OpenEditorRequest, OpenEditorResponse},
};

fn map_search_repo_lookup_error(err: services::services::repo::RepoError) -> ApiError {
    match err {
        services::services::repo::RepoError::NotFound => {
            ApiError::NotFound("Repository not found".to_string())
        }
        other => ApiError::from(other),
    }
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct RegisterRepoRequest {
    pub path: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct InitRepoRequest {
    pub parent_path: String,
    pub folder_name: String,
}

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct BatchRepoRequest {
    pub ids: Vec<Uuid>,
}

fn resolve_repo_file_path_for_editor(
    repo_path: &std::path::Path,
    file_path: &str,
) -> Result<PathBuf, ApiError> {
    let trimmed_file_path = file_path.trim();
    if trimmed_file_path.is_empty() {
        return Ok(repo_path.to_path_buf());
    }

    let relative_path = PathBuf::from(trimmed_file_path);
    if relative_path.is_absolute() {
        return Err(ApiError::BadRequest(
            "file_path must be relative to the repository root".to_string(),
        ));
    }

    if relative_path.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::Prefix(_) | Component::RootDir
        )
    }) {
        return Err(ApiError::BadRequest(
            "file_path must stay within the selected repository".to_string(),
        ));
    }

    Ok(repo_path.join(relative_path))
}

fn resolve_editor_target_file_hint(
    path: &std::path::Path,
    fallback_is_file: bool,
) -> Result<bool, ApiError> {
    match std::fs::metadata(path) {
        Ok(metadata) if metadata.is_file() => Ok(true),
        Ok(metadata) if metadata.is_dir() => Ok(false),
        Ok(_) => Err(ApiError::BadRequest(
            "open-editor target must be a file or directory".to_string(),
        )),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(fallback_is_file),
        Err(err) => Err(ApiError::Io(err)),
    }
}

#[cfg(test)]
mod open_editor_path_tests {
    use std::path::Path;

    use tempfile::tempdir;

    use super::{resolve_editor_target_file_hint, resolve_repo_file_path_for_editor};

    #[test]
    fn rejects_parent_dir_file_path_for_repo_open_editor() {
        let result = resolve_repo_file_path_for_editor(Path::new("/repo"), "../outside");
        assert!(result.is_err(), "parent traversal must be rejected");
    }

    #[test]
    fn resolves_directory_hint_for_existing_directory() {
        let temp = tempdir().expect("temp dir");

        let is_file = resolve_editor_target_file_hint(temp.path(), true).expect("hint");

        assert!(!is_file, "existing directory must not be treated as file");
    }

    #[test]
    fn keeps_file_hint_for_non_existing_target() {
        let temp = tempdir().expect("temp dir");
        let missing_path = temp.path().join("missing.ts");

        let is_file = resolve_editor_target_file_hint(missing_path.as_path(), true).expect("hint");

        assert!(is_file, "missing file should keep fallback file hint");
    }
}

pub async fn register_repo(
    State(deployment): State<DeploymentImpl>,
    ResponseJson(payload): ResponseJson<RegisterRepoRequest>,
) -> Result<ResponseJson<ApiResponse<Repo>>, ApiError> {
    let repo = deployment
        .repo()
        .register(
            &deployment.db().pool,
            &payload.path,
            payload.display_name.as_deref(),
        )
        .await?;

    Ok(ResponseJson(ApiResponse::success(repo)))
}

pub async fn init_repo(
    State(deployment): State<DeploymentImpl>,
    ResponseJson(payload): ResponseJson<InitRepoRequest>,
) -> Result<ResponseJson<ApiResponse<Repo>>, ApiError> {
    let repo = deployment
        .repo()
        .init_repo(
            &deployment.db().pool,
            deployment.git(),
            &payload.parent_path,
            &payload.folder_name,
        )
        .await?;

    Ok(ResponseJson(ApiResponse::success(repo)))
}

pub async fn get_repo_branches(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Vec<GitBranch>>>, ApiError> {
    let repo = deployment
        .repo()
        .get_by_id(&deployment.db().pool, repo_id)
        .await?;

    let branches = deployment.git().get_all_branches(&repo.path)?;
    Ok(ResponseJson(ApiResponse::success(branches)))
}

pub async fn get_repos_batch(
    State(deployment): State<DeploymentImpl>,
    ResponseJson(payload): ResponseJson<BatchRepoRequest>,
) -> Result<ResponseJson<ApiResponse<Vec<Repo>>>, ApiError> {
    let repos = Repo::find_by_ids(&deployment.db().pool, &payload.ids).await?;
    Ok(ResponseJson(ApiResponse::success(repos)))
}

pub async fn get_repos(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<Repo>>>, ApiError> {
    let repos = Repo::list_all(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(repos)))
}

pub async fn get_repo(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Repo>>, ApiError> {
    let repo = deployment
        .repo()
        .get_by_id(&deployment.db().pool, repo_id)
        .await?;
    Ok(ResponseJson(ApiResponse::success(repo)))
}

pub async fn update_repo(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
    ResponseJson(payload): ResponseJson<UpdateRepo>,
) -> Result<ResponseJson<ApiResponse<Repo>>, ApiError> {
    let repo = Repo::update(&deployment.db().pool, repo_id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(repo)))
}

pub async fn open_repo_in_editor(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
    ResponseJson(payload): ResponseJson<Option<OpenEditorRequest>>,
) -> Result<ResponseJson<ApiResponse<OpenEditorResponse>>, ApiError> {
    let repo = deployment
        .repo()
        .get_by_id(&deployment.db().pool, repo_id)
        .await?;

    let editor_config = {
        let config = deployment.config().read().await;
        let editor_type_str = payload.as_ref().and_then(|req| req.editor_type.as_deref());
        config.editor.with_override(editor_type_str)
    };

    let file_path = payload
        .as_ref()
        .and_then(|request| request.file_path.as_deref())
        .filter(|value| !value.trim().is_empty());

    let (path, is_file_hint) = if let Some(file_path) = file_path {
        let path = resolve_repo_file_path_for_editor(repo.path.as_path(), file_path)?;
        let is_file_hint = resolve_editor_target_file_hint(path.as_path(), true)?;
        (path, is_file_hint)
    } else {
        let path = repo.path.clone();
        let is_file_hint = resolve_editor_target_file_hint(path.as_path(), false)?;
        (path, is_file_hint)
    };

    match editor_config
        .open_file_with_hint(path.as_path(), Some(is_file_hint))
        .await
    {
        Ok(url) => {
            tracing::info!(
                "Opened editor for repo {} at path: {}{}",
                repo_id,
                path.to_string_lossy(),
                if url.is_some() { " (remote mode)" } else { "" }
            );

            deployment
                .track_if_analytics_allowed(
                    "repo_editor_opened",
                    serde_json::json!({
                        "repo_id": repo_id.to_string(),
                        "editor_type": payload.as_ref().and_then(|req| req.editor_type.as_ref()),
                        "remote_mode": url.is_some(),
                    }),
                )
                .await;

            Ok(ResponseJson(ApiResponse::success(OpenEditorResponse {
                url,
            })))
        }
        Err(e) => {
            tracing::error!("Failed to open editor for repo {}: {:?}", repo_id, e);
            Err(ApiError::EditorOpen(e))
        }
    }
}

pub async fn search_repo(
    State(deployment): State<DeploymentImpl>,
    Path(repo_id): Path<Uuid>,
    Query(search_query): Query<SearchQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<SearchResult>>>, ApiError> {
    if search_query.q.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Query parameter 'q' is required and cannot be empty".to_string(),
        ));
    }

    let repo = match deployment
        .repo()
        .get_by_id(&deployment.db().pool, repo_id)
        .await
    {
        Ok(repo) => repo,
        Err(e) => {
            tracing::error!("Failed to get repo {}: {}", repo_id, e);
            return Err(map_search_repo_lookup_error(e));
        }
    };

    match deployment
        .file_search_cache()
        .search_repo(&repo.path, &search_query.q, search_query.mode)
        .await
    {
        Ok(results) => Ok(ResponseJson(ApiResponse::success(results))),
        Err(e) => {
            tracing::error!("Failed to search files in repo {}: {}", repo_id, e);
            Err(ApiError::Internal(format!(
                "Failed to search files in repository '{}': {e}",
                repo.name
            )))
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use axum::{http::StatusCode, response::IntoResponse};

    use super::*;

    #[test]
    fn search_repo_not_found_error_maps_to_404() {
        let error = map_search_repo_lookup_error(services::services::repo::RepoError::NotFound);

        assert!(matches!(error, ApiError::NotFound(_)));
        assert_eq!(error.into_response().status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn search_repo_non_not_found_error_is_not_forced_to_404() {
        let error = map_search_repo_lookup_error(
            services::services::repo::RepoError::PathNotFound(PathBuf::from("/tmp/missing")),
        );

        assert!(matches!(error, ApiError::BadRequest(_)));
        assert_eq!(error.into_response().status(), StatusCode::BAD_REQUEST);
    }
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/repos", get(get_repos).post(register_repo))
        .route("/repos/init", post(init_repo))
        .route("/repos/batch", post(get_repos_batch))
        .route("/repos/{repo_id}", get(get_repo).put(update_repo))
        .route("/repos/{repo_id}/branches", get(get_repo_branches))
        .route("/repos/{repo_id}/search", get(search_repo))
        .route("/repos/{repo_id}/open-editor", post(open_repo_in_editor))
}
