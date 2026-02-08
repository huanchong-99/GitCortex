use std::{
    ffi::OsString,
    path::{Component, Path, PathBuf},
};

use axum::{Router, extract::State, response::Json as ResponseJson, routing::post};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use utils::response::ApiResponse;

use crate::{DeploymentImpl, error::ApiError};

fn resolve_request_path(path: &str) -> Result<PathBuf, ApiError> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err(ApiError::BadRequest("path is required".to_string()));
    }

    let normalized_path = trimmed_path.replace('\\', "/");
    let requested_path = PathBuf::from(normalized_path);

    if requested_path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(ApiError::BadRequest("Path is not allowed".to_string()));
    }

    if requested_path.is_absolute() {
        Ok(requested_path)
    } else {
        Ok(std::env::current_dir()?.join(requested_path))
    }
}

fn user_home_directory() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .or_else(|| {
                let home_drive = std::env::var_os("HOMEDRIVE")?;
                let home_path = std::env::var_os("HOMEPATH")?;
                let mut path = PathBuf::from(home_drive);
                path.push(home_path);
                Some(path)
            })
    }

    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

fn allowed_git_roots() -> Result<Vec<PathBuf>, ApiError> {
    let mut roots = Vec::new();

    if let Some(home) = user_home_directory() {
        roots.push(home);
    }
    roots.push(std::env::current_dir()?);

    #[cfg(windows)]
    {
        // Allow local absolute paths on all existing drive roots.
        // This keeps path-boundary checks while supporting workspaces like E:\test\test.
        for drive_letter in b'A'..=b'Z' {
            let root = format!("{}:\\", char::from(drive_letter));
            let root_path = PathBuf::from(&root);
            if root_path.exists() {
                roots.push(root_path);
            }
        }
    }

    let mut normalized_roots = Vec::new();
    for root in roots {
        let canonical_root = std::fs::canonicalize(&root).unwrap_or(root);
        if !normalized_roots
            .iter()
            .any(|existing| existing == &canonical_root)
        {
            normalized_roots.push(canonical_root);
        }
    }

    Ok(normalized_roots)
}

fn canonicalize_with_existing_ancestor(path: &Path) -> Result<PathBuf, ApiError> {
    if path.exists() {
        return Ok(std::fs::canonicalize(path)?);
    }

    let mut current = path.to_path_buf();
    let mut missing_components: Vec<OsString> = Vec::new();

    loop {
        if current.exists() {
            let mut canonical = std::fs::canonicalize(&current)?;
            for component in missing_components.iter().rev() {
                canonical.push(component);
            }
            return Ok(canonical);
        }

        let Some(file_name) = current.file_name() else {
            return Err(ApiError::BadRequest("Path is not allowed".to_string()));
        };
        missing_components.push(file_name.to_os_string());

        let Some(parent) = current.parent() else {
            return Err(ApiError::BadRequest("Path is not allowed".to_string()));
        };
        current = parent.to_path_buf();
    }
}

fn normalize_allowed_roots(allowed_roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut normalized_roots = Vec::new();

    for root in allowed_roots {
        let canonical_root = std::fs::canonicalize(root).unwrap_or_else(|_| root.clone());
        if !normalized_roots
            .iter()
            .any(|existing| existing == &canonical_root)
        {
            normalized_roots.push(canonical_root);
        }
    }

    normalized_roots
}

fn ensure_path_within_allowed_roots(
    path: &Path,
    allowed_roots: &[PathBuf],
) -> Result<(), ApiError> {
    let canonical_path = canonicalize_with_existing_ancestor(path)?;
    let normalized_roots = normalize_allowed_roots(allowed_roots);
    let in_allowed_roots = normalized_roots
        .iter()
        .any(|root| canonical_path.starts_with(root));

    if in_allowed_roots {
        Ok(())
    } else {
        Err(ApiError::BadRequest("Path is not allowed".to_string()))
    }
}

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
    let repo_path = resolve_request_path(&payload.path)?;
    let allowed_roots = allowed_git_roots()?;
    ensure_path_within_allowed_roots(&repo_path, &allowed_roots)?;

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
    let repo_path = resolve_request_path(&payload.path)?;
    let allowed_roots = allowed_git_roots()?;
    ensure_path_within_allowed_roots(&repo_path, &allowed_roots)?;

    deployment
        .git()
        .initialize_repo_with_main_branch(repo_path.as_path())?;
    Ok(ResponseJson(ApiResponse::success(())))
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/git/status", post(git_status))
        .route("/git/init", post(git_init))
}

#[cfg(test)]
mod path_boundary_tests {
    use std::path::PathBuf;

    use tempfile::tempdir;

    use super::{
        canonicalize_with_existing_ancestor, ensure_path_within_allowed_roots, resolve_request_path,
    };
    use crate::error::ApiError;

    #[test]
    fn resolves_relative_request_path_against_current_dir() {
        let resolved = resolve_request_path("./foo/bar").expect("path should resolve");
        assert!(resolved.is_absolute(), "resolved path must be absolute");
    }

    #[test]
    fn rejects_empty_request_path() {
        let result = resolve_request_path("   ");
        assert!(matches!(result, Err(ApiError::BadRequest(_))));
    }

    #[test]
    fn rejects_parent_dir_components_in_request_path() {
        let result = resolve_request_path("../outside");
        assert!(matches!(result, Err(ApiError::BadRequest(_))));
    }

    #[test]
    fn allows_existing_path_inside_allowed_root() {
        let allowed_root = tempdir().expect("failed to create allowed root");
        let project_dir = allowed_root.path().join("repo");
        std::fs::create_dir_all(&project_dir).expect("failed to create project dir");

        let result =
            ensure_path_within_allowed_roots(&project_dir, &[allowed_root.path().to_path_buf()]);

        assert!(result.is_ok(), "path inside allowed root should pass");
    }

    #[test]
    fn allows_non_existing_path_inside_allowed_root() {
        let allowed_root = tempdir().expect("failed to create allowed root");
        let not_created_yet = allowed_root.path().join("new-repo");

        let result = ensure_path_within_allowed_roots(
            &not_created_yet,
            &[allowed_root.path().to_path_buf()],
        );

        assert!(
            result.is_ok(),
            "non-existing descendant under allowed root should pass"
        );
    }

    #[test]
    fn rejects_existing_path_outside_allowed_root() {
        let allowed_root = tempdir().expect("failed to create allowed root");
        let outside_root = tempdir().expect("failed to create outside root");

        let result = ensure_path_within_allowed_roots(
            outside_root.path(),
            &[allowed_root.path().to_path_buf()],
        );

        assert!(
            matches!(result, Err(ApiError::BadRequest(_))),
            "outside path must be rejected"
        );
    }

    #[test]
    fn canonicalizes_parent_dir_traversal_before_boundary_check() {
        let allowed_root = tempdir().expect("failed to create allowed root");
        let outside_root = tempdir().expect("failed to create outside root");

        let traversal_path = outside_root.path().join("..").join(
            outside_root
                .path()
                .file_name()
                .expect("outside root should have file name"),
        );

        let canonical =
            canonicalize_with_existing_ancestor(&traversal_path).expect("canonicalization failed");

        assert_eq!(
            canonical,
            std::fs::canonicalize(outside_root.path())
                .expect("failed to canonicalize outside root")
        );

        let result = ensure_path_within_allowed_roots(
            &traversal_path,
            &[PathBuf::from(allowed_root.path())],
        );
        assert!(matches!(result, Err(ApiError::BadRequest(_))));
    }
}
