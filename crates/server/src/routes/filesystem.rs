use axum::{
    Router,
    extract::{Query, State},
    response::Json as ResponseJson,
    routing::{get, post},
};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use services::services::filesystem::{DirectoryEntry, DirectoryListResponse, FilesystemError};
use ts_rs::TS;
use utils::response::ApiResponse;

#[cfg(windows)]
use raw_window_handle::{
    DisplayHandle, HandleError, HasDisplayHandle, HasWindowHandle, RawDisplayHandle,
    RawWindowHandle, Win32WindowHandle, WindowHandle, WindowsDisplayHandle,
};
#[cfg(windows)]
use std::num::NonZeroIsize;
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Deserialize)]
pub struct ListDirectoryQuery {
    path: Option<String>,
}

#[derive(Debug, Serialize, TS)]
#[ts(export)]
pub struct FolderPickerResponse {
    pub path: Option<String>,
    pub cancelled: bool,
}

/// Helper struct to wrap a foreground window handle for rfd parent binding.
#[cfg(windows)]
#[derive(Clone, Copy)]
struct ForegroundWindow {
    hwnd: NonZeroIsize,
}

#[cfg(windows)]
impl HasWindowHandle for ForegroundWindow {
    fn window_handle(&self) -> Result<WindowHandle<'_>, HandleError> {
        let handle = Win32WindowHandle::new(self.hwnd);
        let raw = RawWindowHandle::Win32(handle);
        // SAFETY: The handle is valid for the duration of the dialog operation
        Ok(unsafe { WindowHandle::borrow_raw(raw) })
    }
}

#[cfg(windows)]
impl HasDisplayHandle for ForegroundWindow {
    fn display_handle(&self) -> Result<DisplayHandle<'_>, HandleError> {
        let raw = RawDisplayHandle::Windows(WindowsDisplayHandle::new());
        // SAFETY: Windows display handle is always valid
        Ok(unsafe { DisplayHandle::borrow_raw(raw) })
    }
}

/// Get the current foreground window handle.
#[cfg(windows)]
fn foreground_window() -> Option<ForegroundWindow> {
    // SAFETY: GetForegroundWindow is safe to call and returns a valid HWND or NULL
    let hwnd = unsafe { GetForegroundWindow() };
    NonZeroIsize::new(hwnd as isize).map(|hwnd| ForegroundWindow { hwnd })
}

/// Opens a native folder picker dialog and returns the selected path.
#[cfg(windows)]
pub async fn pick_folder() -> Result<ResponseJson<ApiResponse<FolderPickerResponse>>, ApiError> {
    // Capture foreground window on the main thread before spawning blocking task
    let parent_hwnd = foreground_window();

    let result = tokio::task::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new()
            .set_title("Select Project Directory");

        // Bind to foreground window to ensure dialog appears in front
        if let Some(parent) = parent_hwnd {
            dialog = dialog.set_parent(&parent);
        } else {
            tracing::warn!("No foreground window found; folder picker may open behind other windows");
        }

        dialog.pick_folder()
    })
    .await
    .map_err(|e| ApiError::Internal(format!("Failed to spawn blocking task: {e}")))?;

    match result {
        Some(path) => Ok(ResponseJson(ApiResponse::success(FolderPickerResponse {
            path: Some(path.to_string_lossy().to_string()),
            cancelled: false,
        }))),
        None => Ok(ResponseJson(ApiResponse::success(FolderPickerResponse {
            path: None,
            cancelled: true,
        }))),
    }
}

/// Stub for non-Windows platforms - folder picker is not supported.
#[cfg(not(windows))]
pub async fn pick_folder() -> Result<ResponseJson<ApiResponse<FolderPickerResponse>>, ApiError> {
    Err(ApiError::Internal("Folder picker is only supported on Windows".to_string()))
}

pub async fn list_directory(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListDirectoryQuery>,
) -> Result<ResponseJson<ApiResponse<DirectoryListResponse>>, ApiError> {
    match deployment.filesystem().list_directory_async(query.path).await {
        Ok(response) => Ok(ResponseJson(ApiResponse::success(response))),
        Err(FilesystemError::DirectoryDoesNotExist) => {
            Ok(ResponseJson(ApiResponse::error("Directory does not exist")))
        }
        Err(FilesystemError::PathIsNotDirectory) => {
            Ok(ResponseJson(ApiResponse::error("Path is not a directory")))
        }
        Err(FilesystemError::PathOutsideAllowedRoots) => {
            Ok(ResponseJson(ApiResponse::error("Path is not allowed")))
        }
        Err(FilesystemError::Io(e)) => {
            tracing::error!("Failed to read directory: {e}");
            Ok(ResponseJson(ApiResponse::error(&format!(
                "Failed to read directory: {e}"
            ))))
        }
    }
}

pub async fn list_git_repos(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListDirectoryQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<DirectoryEntry>>>, ApiError> {
    let res = if let Some(ref path) = query.path {
        deployment
            .filesystem()
            .list_git_repos(Some(path.clone()), 800, 1200, Some(3))
            .await
    } else {
        deployment
            .filesystem()
            .list_common_git_repos(800, 1200, Some(4))
            .await
    };
    match res {
        Ok(response) => Ok(ResponseJson(ApiResponse::success(response))),
        Err(FilesystemError::DirectoryDoesNotExist) => {
            Ok(ResponseJson(ApiResponse::error("Directory does not exist")))
        }
        Err(FilesystemError::PathIsNotDirectory) => {
            Ok(ResponseJson(ApiResponse::error("Path is not a directory")))
        }
        Err(FilesystemError::PathOutsideAllowedRoots) => {
            Ok(ResponseJson(ApiResponse::error("Path is not allowed")))
        }
        Err(FilesystemError::Io(e)) => {
            tracing::error!("Failed to read directory: {e}");
            Ok(ResponseJson(ApiResponse::error(&format!(
                "Failed to read directory: {e}"
            ))))
        }
    }
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/filesystem/directory", get(list_directory))
        .route("/filesystem/git-repos", get(list_git_repos))
        .route("/filesystem/pick-folder", post(pick_folder))
}
