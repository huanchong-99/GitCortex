#![warn(clippy::pedantic)]
#![allow(
    clippy::doc_markdown,
    clippy::module_name_repetitions,
    clippy::must_use_candidate,
    clippy::missing_errors_doc,
    clippy::missing_panics_doc,
    clippy::similar_names,
    clippy::too_many_lines
)]

use std::sync::Arc;

use anyhow::{self, Error as AnyhowError};
use deployment::{Deployment, DeploymentError};
use server::{
    DeploymentImpl, routes,
    routes::{SharedSubscriptionHub, event_bridge::EventBridge, subscription_hub::SubscriptionHub},
};
use services::services::container::ContainerService;
use sqlx::Error as SqlxError;
use strip_ansi_escapes::strip;
use thiserror::Error;
use tracing_subscriber::{EnvFilter, prelude::*};
use utils::{
    assets::asset_dir,
    browser::open_browser,
    port_file::write_port_file,
    sentry::{self as sentry_utils, SentrySource, sentry_layer},
};

const DEV_DEFAULT_ENCRYPTION_KEY: &str = "12345678901234567890123456789012";

fn ensure_dev_encryption_key() {
    if !cfg!(debug_assertions) {
        return;
    }

    match std::env::var("GITCORTEX_ENCRYPTION_KEY") {
        Ok(value) if value.len() == 32 => {}
        Ok(value) => {
            tracing::warn!(
                provided_length = value.len(),
                "GITCORTEX_ENCRYPTION_KEY is set but length is invalid; workflow start may fail"
            );
        }
        Err(_) => {
            unsafe {
                std::env::set_var("GITCORTEX_ENCRYPTION_KEY", DEV_DEFAULT_ENCRYPTION_KEY);
            }
            tracing::warn!(
                "GITCORTEX_ENCRYPTION_KEY not set; using development fallback key"
            );
        }
    }
}

#[derive(Debug, Error)]
pub enum GitCortexError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Sqlx(#[from] SqlxError),
    #[error(transparent)]
    Deployment(#[from] DeploymentError),
    #[error(transparent)]
    Other(#[from] AnyhowError),
}

#[tokio::main]
async fn main() -> Result<(), GitCortexError> {
    // Load environment variables from .env file
    dotenv::dotenv().ok();
    ensure_dev_encryption_key();

    // Install rustls crypto provider before any TLS operations
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    sentry_utils::init_once(SentrySource::Backend);

    let log_level = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    let filter_string = format!(
        "warn,server={log_level},services={log_level},db={log_level},executors={log_level},deployment={log_level},local_deployment={log_level},utils={log_level}"
    );
    let env_filter = EnvFilter::try_new(filter_string).expect("Failed to create tracing filter");
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().with_filter(env_filter))
        .with(sentry_layer())
        .init();

    // Create asset directory if it doesn't exist
    let _asset_dir = asset_dir()?;

    let deployment = DeploymentImpl::new().await?;
    deployment.update_sentry_scope().await?;
    deployment
        .container()
        .cleanup_orphan_executions()
        .await
        .map_err(DeploymentError::from)?;
    deployment
        .container()
        .backfill_before_head_commits()
        .await
        .map_err(DeploymentError::from)?;
    deployment
        .container()
        .backfill_repo_names()
        .await
        .map_err(DeploymentError::from)?;
    deployment.spawn_pr_monitor_service();
    deployment
        .track_if_analytics_allowed("session_start", serde_json::json!({}))
        .await;
    // Pre-warm file search cache for most active projects
    let deployment_for_cache = deployment.clone();
    tokio::spawn(async move {
        if let Err(e) = deployment_for_cache
            .file_search_cache()
            .warm_most_active(&deployment_for_cache.db().pool, 3)
            .await
        {
            tracing::warn!("Failed to warm file search cache: {}", e);
        }
    });

    // Initialize WebSocket subscription hub and event bridge
    let subscription_hub: SharedSubscriptionHub = Arc::new(SubscriptionHub::default());
    let event_bridge = EventBridge::new(deployment.message_bus().clone(), subscription_hub.clone());
    let _event_bridge_handle = event_bridge.spawn();
    tracing::info!("WebSocket event bridge started");

    // Conditional Feishu connector startup
    if is_feishu_enabled() {
        match start_feishu_connector(&deployment).await {
            Ok(()) => tracing::info!("Feishu connector started"),
            Err(e) => tracing::warn!("Feishu connector startup skipped: {e}"),
        }
    } else {
        tracing::debug!("Feishu integration disabled (GITCORTEX_FEISHU_ENABLED not set)");
    }

    let app_router = routes::router(deployment.clone(), subscription_hub);

    let port = std::env::var("BACKEND_PORT")
        .or_else(|_| std::env::var("PORT"))
        .ok()
        .and_then(|s| {
            // remove any ANSI codes, then turn into String
            let cleaned =
                String::from_utf8(strip(s.as_bytes())).expect("UTF-8 after stripping ANSI");
            cleaned.trim().parse::<u16>().ok()
        })
        .unwrap_or_else(|| {
            tracing::info!("No PORT environment variable set, using default port 23456");
            23456
        }); // Default port: 23456 (chosen to avoid common dev ports and system ranges)

    let host = std::env::var("HOST").unwrap_or_else(|_| {
        if std::path::Path::new("/.dockerenv").exists() {
            "0.0.0.0".to_string()
        } else {
            "127.0.0.1".to_string()
        }
    });
    let listener = tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;
    let actual_port = listener.local_addr()?.port(); // get → 53427 (example)

    // Write port file for discovery if prod, warn on fail
    if let Err(e) = write_port_file(actual_port).await {
        tracing::warn!("Failed to write port file: {}", e);
    }

    tracing::info!("Server running on http://{host}:{actual_port}");

    if !cfg!(debug_assertions) && !std::path::Path::new("/.dockerenv").exists() {
        tracing::info!("Opening browser...");
        tokio::spawn(async move {
            if let Err(e) = open_browser(&format!("http://127.0.0.1:{actual_port}")) {
                tracing::warn!(
                    "Failed to open browser automatically: {}. Please open http://127.0.0.1:{} manually.",
                    e,
                    actual_port
                );
            }
        });
    }

    axum::serve(listener, app_router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    perform_cleanup_actions(&deployment).await;

    Ok(())
}

pub async fn shutdown_signal() {
    // Always wait for Ctrl+C
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::error!("Failed to install Ctrl+C handler: {e}");
        }
    };

    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};

        // Try to install SIGTERM handler, but don't panic if it fails
        let terminate = async {
            if let Ok(mut sigterm) = signal(SignalKind::terminate()) {
                sigterm.recv().await;
            } else {
                tracing::error!("Failed to install SIGTERM handler");
                // Fallback: never resolves
                std::future::pending::<()>().await;
            }
        };

        tokio::select! {
            _ = ctrl_c => {},
            _ = terminate => {},
        }
    }

    #[cfg(not(unix))]
    {
        // Only ctrl_c is available, so just await it
        ctrl_c.await;
    }
}

pub async fn perform_cleanup_actions(deployment: &DeploymentImpl) {
    deployment
        .container()
        .kill_all_running_processes()
        .await
        .expect("Failed to cleanly kill running execution processes");
}

/// Check whether the Feishu integration feature flag is enabled.
fn is_feishu_enabled() -> bool {
    std::env::var("GITCORTEX_FEISHU_ENABLED")
        .ok()
        .is_some_and(|v| v.trim().eq_ignore_ascii_case("true") || v.trim() == "1")
}

/// Attempt to start the Feishu connector by loading config from the database.
///
/// If no enabled config exists, this returns an informational error without
/// crashing the server. Once `FeishuService` is fully implemented by another
/// agent, this function should create the service, start the WebSocket
/// connection, and store the handle in `AppState` for route access.
async fn start_feishu_connector(deployment: &DeploymentImpl) -> Result<(), AnyhowError> {
    use db::models::feishu_config::FeishuAppConfig;
    use deployment::Deployment;

    let config = FeishuAppConfig::find_enabled(&deployment.db().pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query feishu_app_config: {e}"))?;

    let Some(config) = config else {
        return Err(anyhow::anyhow!(
            "No enabled Feishu config found in database; skipping connector startup"
        ));
    };

    tracing::info!(
        app_id = %config.app_id,
        base_url = %config.base_url,
        "Feishu config loaded from database"
    );

    // TODO: Wire up FeishuService once it is available:
    //
    // 1. Decrypt config.app_secret_encrypted using GITCORTEX_ENCRYPTION_KEY
    // 2. Create FeishuConfig { app_id, app_secret, base_url }
    // 3. Create FeishuClient::new(feishu_config)
    // 4. Spawn the client.connect() loop with reconnect policy
    // 5. Store the FeishuService handle in AppState for route access
    //
    // For now, the connector is acknowledged but not connected.

    Ok(())
}
