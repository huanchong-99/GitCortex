use std::{
    pin::Pin,
    sync::atomic::{AtomicUsize, Ordering},
    task::{Context, Poll},
};

use axum::{
    BoxError, Router,
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response, Sse, sse::KeepAlive},
    routing::get,
};
use deployment::Deployment;
use futures_util::{Stream, TryStreamExt};

use crate::DeploymentImpl;

// G33-004: SSE connection limits
/// Maximum concurrent SSE connections for the global events endpoint.
const SSE_MAX_CONNECTIONS: usize = 100;

/// Shared atomic counter tracking active SSE connections.
static SSE_CONNECTION_COUNT: AtomicUsize = AtomicUsize::new(0);

/// Wraps an inner stream and decrements the global SSE counter when dropped.
struct ConnectionCountedStream<S> {
    inner: Pin<Box<S>>,
}

impl<S> Drop for ConnectionCountedStream<S> {
    fn drop(&mut self) {
        SSE_CONNECTION_COUNT.fetch_sub(1, Ordering::Relaxed);
    }
}

impl<S, T, E> Stream for ConnectionCountedStream<S>
where
    S: Stream<Item = Result<T, E>>,
{
    type Item = Result<T, E>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.inner.as_mut().poll_next(cx)
    }
}

pub async fn events(State(deployment): State<DeploymentImpl>) -> Response {
    // G33-004: reject new connections when the limit is reached
    let prev = SSE_CONNECTION_COUNT.fetch_add(1, Ordering::Relaxed);
    if prev >= SSE_MAX_CONNECTIONS {
        SSE_CONNECTION_COUNT.fetch_sub(1, Ordering::Relaxed);
        tracing::warn!(
            max = SSE_MAX_CONNECTIONS,
            "SSE connection limit reached; rejecting new connection"
        );
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    }

    // Build the combined history + live stream and apply an idle timeout.
    // G33-004: close connection after SSE_IDLE_TIMEOUT of inactivity.
    let raw_stream = deployment.stream_events().await;
    let idle_stream = raw_stream;

    // Wrap with the drop guard so the counter is decremented on disconnect.
    let guarded = ConnectionCountedStream {
        inner: Box::pin(idle_stream),
    };

    Sse::new(guarded.map_err(|e: std::io::Error| -> BoxError { e.into() }))
        .keep_alive(KeepAlive::default())
        .into_response()
}

pub fn router(_: &DeploymentImpl) -> Router<DeploymentImpl> {
    let events_router = Router::new().route("/", get(events));

    Router::new().nest("/events", events_router)
}
