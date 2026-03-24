//! Concierge Agent REST API routes.
//!
//! Provides session management and message handling for the Concierge Agent.

use std::sync::Arc;

use axum::{
    Extension, Json, Router,
    extract::{Path, Query, State},
    response::Json as ResponseJson,
    routing::{delete, get, post},
};
use db::models::concierge::{ConciergeMessage, ConciergeSession, ConciergeSessionChannel};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use services::services::concierge::ConciergeAgent;
use utils::response::ApiResponse;

use crate::{DeploymentImpl, error::ApiError, feishu_handle::SharedFeishuHandle};

pub type SharedConciergeAgent = Arc<ConciergeAgent>;

// ============================================================================
// Route Definition
// ============================================================================

pub fn concierge_routes() -> Router<DeploymentImpl> {
    Router::new()
        .route("/sessions", post(create_session))
        .route("/sessions", get(list_sessions))
        .route("/sessions/{id}", get(get_session).delete(delete_session))
        .route("/sessions/{id}/messages", post(send_message))
        .route("/sessions/{id}/messages", get(list_messages))
        .route("/sessions/{id}/channels", post(add_channel))
        .route(
            "/sessions/{id}/channels/{channel_id}",
            delete(remove_channel),
        )
        .route("/sessions/{id}/settings", post(update_settings))
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSessionRequest {
    pub name: Option<String>,
    pub llm_model_id: Option<String>,
    pub llm_api_type: Option<String>,
    pub llm_base_url: Option<String>,
    pub llm_api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageRequest {
    pub message: String,
    pub source: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddChannelRequest {
    pub provider: String,
    pub external_id: String,
    pub user_identifier: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsRequest {
    pub feishu_sync: Option<bool>,
    pub sync_history: Option<bool>,
    pub progress_notifications: Option<bool>,
    pub sync_tools: Option<bool>,
    pub sync_terminal: Option<bool>,
    pub sync_progress: Option<bool>,
    pub notify_on_completion: Option<bool>,
    pub llm_model_id: Option<String>,
    pub llm_api_type: Option<String>,
    pub llm_base_url: Option<String>,
    pub llm_api_key: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageResponse {
    pub assistant_message: String,
    pub messages: Vec<ConciergeMessage>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesQuery {
    pub cursor: Option<usize>,
    pub limit: Option<usize>,
}

// ============================================================================
// Handlers
// ============================================================================

async fn create_session(
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<CreateSessionRequest>,
) -> Result<ResponseJson<ApiResponse<ConciergeSession>>, ApiError> {
    let pool = &deployment.db().pool;
    let name = payload.name.as_deref().unwrap_or("");
    let mut session = ConciergeSession::new(name);

    // Configure LLM if provided
    if let Some(ref api_key) = payload.llm_api_key {
        let encrypted = ConciergeSession::encrypt_api_key(api_key)
            .map_err(|e| ApiError::Internal(format!("Encryption failed: {e}")))?;
        session.llm_api_key_encrypted = Some(encrypted);
    }
    session.llm_model_id = payload.llm_model_id;
    session.llm_api_type = payload.llm_api_type;
    session.llm_base_url = payload.llm_base_url;

    ConciergeSession::insert(pool, &session)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to create session: {e}")))?;

    Ok(ResponseJson(ApiResponse::success(session)))
}

async fn list_sessions(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<ConciergeSession>>>, ApiError> {
    let sessions = ConciergeSession::list_all(&deployment.db().pool)
        .await
        .map_err(|e| ApiError::Internal(format!("Failed to list sessions: {e}")))?;
    Ok(ResponseJson(ApiResponse::success(sessions)))
}

async fn delete_session(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    ConciergeSession::delete(&deployment.db().pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?;
    Ok(ResponseJson(ApiResponse::success(())))
}

async fn get_session(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
) -> Result<ResponseJson<ApiResponse<ConciergeSession>>, ApiError> {
    let session = ConciergeSession::find_by_id(&deployment.db().pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?
        .ok_or_else(|| ApiError::NotFound("Session not found".to_string()))?;
    Ok(ResponseJson(ApiResponse::success(session)))
}

async fn send_message(
    State(deployment): State<DeploymentImpl>,
    Extension(concierge): Extension<SharedConciergeAgent>,
    Path(id): Path<String>,
    Json(payload): Json<SendMessageRequest>,
) -> Result<ResponseJson<ApiResponse<SendMessageResponse>>, ApiError> {
    let message = payload.message.trim();
    if message.is_empty() {
        return Err(ApiError::BadRequest("message is required".to_string()));
    }

    let source = payload.source.as_deref().unwrap_or("web");
    let pool = &deployment.db().pool;

    // Verify session exists
    let _session = ConciergeSession::find_by_id(pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?
        .ok_or_else(|| ApiError::NotFound("Session not found".to_string()))?;

    let assistant_response = concierge
        .process_message(&id, message, Some(source), None)
        .await
        .map_err(|e| ApiError::Internal(format!("Concierge error: {e}")))?;

    // Return all messages
    let messages = ConciergeMessage::list_by_session(pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?;

    Ok(ResponseJson(ApiResponse::success(SendMessageResponse {
        assistant_message: assistant_response,
        messages,
    })))
}

async fn list_messages(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    Query(query): Query<ListMessagesQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<ConciergeMessage>>>, ApiError> {
    let pool = &deployment.db().pool;
    let cursor = query.cursor.unwrap_or(0);
    let limit = query.limit.unwrap_or(100);

    let messages = ConciergeMessage::list_by_session_paginated(pool, &id, cursor, limit)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?;
    Ok(ResponseJson(ApiResponse::success(messages)))
}

async fn add_channel(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<String>,
    Json(payload): Json<AddChannelRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let pool = &deployment.db().pool;
    // Verify session exists
    let _session = ConciergeSession::find_by_id(pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?
        .ok_or_else(|| ApiError::NotFound("Session not found".to_string()))?;

    ConciergeSessionChannel::upsert(
        pool,
        &id,
        &payload.provider,
        &payload.external_id,
        payload.user_identifier.as_deref(),
    )
    .await
    .map_err(|e| ApiError::Internal(format!("Failed to add channel: {e}")))?;

    Ok(ResponseJson(ApiResponse::success(())))
}

async fn remove_channel(
    State(deployment): State<DeploymentImpl>,
    Path((_id, channel_id)): Path<(String, String)>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    ConciergeSessionChannel::delete_by_id(&deployment.db().pool, &channel_id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?;
    Ok(ResponseJson(ApiResponse::success(())))
}

async fn update_settings(
    State(deployment): State<DeploymentImpl>,
    Extension(feishu_handle): Extension<SharedFeishuHandle>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSettingsRequest>,
) -> Result<ResponseJson<ApiResponse<ConciergeSession>>, ApiError> {
    let pool = &deployment.db().pool;
    let session = ConciergeSession::find_by_id(pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?
        .ok_or_else(|| ApiError::NotFound("Session not found".to_string()))?;

    if let Some(feishu_sync) = payload.feishu_sync {
        ConciergeSession::update_feishu_sync(pool, &id, feishu_sync)
            .await
            .map_err(|e| ApiError::Internal(format!("{e}")))?;

        // When enabling feishu sync with sync_history, push existing messages to Feishu
        if feishu_sync && payload.sync_history.unwrap_or(false) {
            let handle_guard = feishu_handle.read().await;
            if let Some(ref h) = *handle_guard {
                if *h.connected.read().await {
                    let messenger = h.messenger.clone();
                    // Resolve chat_id from last received message or DB binding
                    let last_id = h.last_chat_id.try_read().ok().and_then(|g| g.clone());
                    drop(handle_guard);

                    let chat_id = if let Some(cid) = last_id {
                        Some(cid)
                    } else {
                        db::models::ExternalConversationBinding::find_latest_active(
                            pool, "feishu",
                        )
                        .await
                        .ok()
                        .flatten()
                        .map(|b| b.conversation_id)
                    };

                    if let Some(chat_id) = chat_id {
                        let messages = ConciergeMessage::list_by_session(pool, &id)
                            .await
                            .unwrap_or_default();
                        let session_name = session.name.clone();
                        tokio::spawn(async move {
                            if let Err(e) = messenger
                                .send_text(
                                    &chat_id,
                                    &format!(
                                        "[Concierge: {}] Syncing conversation history...",
                                        session_name
                                    ),
                                )
                                .await
                            {
                                tracing::warn!("Failed to send Feishu history header: {e}");
                                return;
                            }
                            for msg in &messages {
                                let prefix = match msg.role.as_str() {
                                    "user" => "[User]",
                                    "assistant" => "[Assistant]",
                                    "tool_call" => "[Tool Call]",
                                    "tool_result" => "[Tool Result]",
                                    _ => "[System]",
                                };
                                let text = format!("{prefix} {}", msg.content);
                                let truncated = if text.len() > 4000 {
                                    format!("{}...(truncated)", &text[..4000])
                                } else {
                                    text
                                };
                                if let Err(e) =
                                    messenger.send_text(&chat_id, &truncated).await
                                {
                                    tracing::warn!(
                                        "Failed to push concierge message to Feishu: {e}"
                                    );
                                    break;
                                }
                            }
                            tracing::info!(
                                "Feishu history sync complete: {} messages sent",
                                messages.len()
                            );
                        });
                    }
                } else {
                    drop(handle_guard);
                }
            }
        }
    }
    if let Some(progress) = payload.progress_notifications {
        ConciergeSession::update_progress_notifications(pool, &id, progress)
            .await
            .map_err(|e| ApiError::Internal(format!("{e}")))?;
    }
    // Update sync toggles if any are provided
    if payload.sync_tools.is_some()
        || payload.sync_terminal.is_some()
        || payload.sync_progress.is_some()
        || payload.notify_on_completion.is_some()
    {
        // Reload current values to merge partial updates
        let current = ConciergeSession::find_by_id(pool, &id)
            .await
            .map_err(|e| ApiError::Internal(format!("{e}")))?
            .ok_or_else(|| ApiError::NotFound("Session not found".to_string()))?;
        ConciergeSession::update_sync_toggles(
            pool,
            &id,
            payload.sync_tools.unwrap_or(current.sync_tools),
            payload.sync_terminal.unwrap_or(current.sync_terminal),
            payload.sync_progress.unwrap_or(current.sync_progress),
            payload.notify_on_completion.unwrap_or(current.notify_on_completion),
        )
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?;
    }
    if payload.llm_api_key.is_some() || payload.llm_model_id.is_some() {
        let encrypted_key = match &payload.llm_api_key {
            Some(key) => Some(
                ConciergeSession::encrypt_api_key(key)
                    .map_err(|e| ApiError::Internal(format!("Encryption failed: {e}")))?,
            ),
            None => None,
        };
        ConciergeSession::update_llm_config(
            pool,
            &id,
            payload.llm_model_id.as_deref(),
            payload.llm_api_type.as_deref(),
            payload.llm_base_url.as_deref(),
            encrypted_key.as_deref(),
        )
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?;
    }

    let updated = ConciergeSession::find_by_id(pool, &id)
        .await
        .map_err(|e| ApiError::Internal(format!("{e}")))?
        .ok_or_else(|| ApiError::NotFound("Session not found".to_string()))?;

    Ok(ResponseJson(ApiResponse::success(updated)))
}
