use axum::{
    Json, Router,
    extract::{
        Path, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::{IntoResponse, Json as ResponseJson},
    routing::get,
};
use db::models::scratch::{CreateScratch, Scratch, ScratchType, UpdateScratch};
use deployment::Deployment;
use futures_util::{SinkExt, StreamExt, TryStreamExt};
use serde::Deserialize;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

const WS_HEARTBEAT_INTERVAL_SECS: u64 = 30;

/// Path parameters for scratch routes with composite key
#[derive(Deserialize)]
pub struct ScratchPath {
    scratch_type: ScratchType,
    id: Uuid,
}

pub async fn list_scratch(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<Scratch>>>, ApiError> {
    let scratch_items = Scratch::find_all(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(scratch_items)))
}

pub async fn get_scratch(
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
) -> Result<ResponseJson<ApiResponse<Scratch>>, ApiError> {
    let scratch = Scratch::find_by_id(&deployment.db().pool, id, &scratch_type)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Scratch not found".to_string()))?;
    Ok(ResponseJson(ApiResponse::success(scratch)))
}

pub async fn create_scratch(
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
    Json(payload): Json<CreateScratch>,
) -> Result<ResponseJson<ApiResponse<Scratch>>, ApiError> {
    // Reject edits to draft_follow_up if a message is queued for this task attempt
    if matches!(scratch_type, ScratchType::DraftFollowUp)
        && deployment.queued_message_service().has_queued(id)
    {
        return Err(ApiError::BadRequest(
            "Cannot edit scratch while a message is queued".to_string(),
        ));
    }

    // Validate that payload type matches URL type
    payload
        .payload
        .validate_type(scratch_type)
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    let scratch = Scratch::create(&deployment.db().pool, id, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(scratch)))
}

pub async fn update_scratch(
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
    Json(payload): Json<UpdateScratch>,
) -> Result<ResponseJson<ApiResponse<Scratch>>, ApiError> {
    // Reject edits to draft_follow_up if a message is queued for this task attempt
    if matches!(scratch_type, ScratchType::DraftFollowUp)
        && deployment.queued_message_service().has_queued(id)
    {
        return Err(ApiError::BadRequest(
            "Cannot edit scratch while a message is queued".to_string(),
        ));
    }

    // Validate that payload type matches URL type
    payload
        .payload
        .validate_type(scratch_type)
        .map_err(|e| ApiError::BadRequest(e.to_string()))?;

    // Upsert: creates if not exists, updates if exists
    let scratch = Scratch::update(&deployment.db().pool, id, &scratch_type, &payload).await?;
    Ok(ResponseJson(ApiResponse::success(scratch)))
}

pub async fn delete_scratch(
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let rows = Scratch::delete(&deployment.db().pool, id, &scratch_type).await?;
    if rows == 0 {
        return Err(ApiError::BadRequest("Scratch not found".to_string()));
    }
    Ok(ResponseJson(ApiResponse::success(())))
}

pub async fn stream_scratch_ws(
    ws: WebSocketUpgrade,
    State(deployment): State<DeploymentImpl>,
    Path(ScratchPath { scratch_type, id }): Path<ScratchPath>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| async move {
        if let Err(e) = handle_scratch_ws(socket, deployment, id, scratch_type).await {
            tracing::warn!("scratch WS closed: {}", e);
        }
    })
}

async fn handle_scratch_ws(
    socket: WebSocket,
    deployment: DeploymentImpl,
    id: Uuid,
    scratch_type: ScratchType,
) -> anyhow::Result<()> {
    let mut stream = deployment
        .events()
        .stream_scratch_raw(id, &scratch_type)
        .await?
        .map_ok(|msg| msg.to_ws_message_unchecked());

    let (mut sender, mut receiver) = socket.split();
    let mut heartbeat =
        tokio::time::interval(tokio::time::Duration::from_secs(WS_HEARTBEAT_INTERVAL_SECS));
    let mut client_closed = false;

    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                if sender.send(Message::Ping(Vec::new().into())).await.is_err() {
                    tracing::debug!(scratch_id = %id, scratch_type = ?scratch_type, "scratch WS heartbeat send failed; closing");
                    client_closed = true;
                    break;
                }
            }
            item = stream.next() => {
                match item {
                    Some(Ok(msg)) => {
                        if sender.send(msg).await.is_err() {
                            tracing::debug!(scratch_id = %id, scratch_type = ?scratch_type, "scratch WS send failed; client disconnected");
                            client_closed = true;
                            break;
                        }
                    }
                    Some(Err(e)) => {
                        tracing::error!(scratch_id = %id, scratch_type = ?scratch_type, "scratch stream error: {}", e);
                        break;
                    }
                    None => break,
                }
            }
            msg = receiver.next() => {
                match msg {
                    Some(Ok(Message::Close(_))) => {
                        tracing::debug!(scratch_id = %id, scratch_type = ?scratch_type, "scratch WS client requested close");
                        client_closed = true;
                        break;
                    }
                    Some(Ok(Message::Ping(payload))) => {
                        if sender.send(Message::Pong(payload)).await.is_err() {
                            tracing::debug!(scratch_id = %id, scratch_type = ?scratch_type, "scratch WS failed to respond pong");
                            break;
                        }
                    }
                    Some(Ok(Message::Pong(_))) => {}
                    Some(Ok(_)) => {}
                    Some(Err(e)) => {
                        tracing::debug!(scratch_id = %id, scratch_type = ?scratch_type, error = %e, "scratch WS receive error");
                        client_closed = true;
                        break;
                    }
                    None => {
                        tracing::debug!(scratch_id = %id, scratch_type = ?scratch_type, "scratch WS receiver closed");
                        client_closed = true;
                        break;
                    }
                }
            }
        }
    }

    if !client_closed {
        let _ = sender.send(Message::Close(None)).await;
    }
    let _ = sender.close().await;

    Ok(())
}

pub fn router(_deployment: &DeploymentImpl) -> Router<DeploymentImpl> {
    Router::new()
        .route("/scratch", get(list_scratch))
        .route(
            "/scratch/{scratch_type}/{id}",
            get(get_scratch)
                .post(create_scratch)
                .put(update_scratch)
                .delete(delete_scratch),
        )
        .route(
            "/scratch/{scratch_type}/{id}/stream/ws",
            get(stream_scratch_ws),
        )
}
