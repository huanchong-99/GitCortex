//! Orchestrator Runtime Service
//!
//! Manages multiple OrchestratorAgent instances, one per active workflow.

use std::{collections::HashMap, path::PathBuf, sync::Arc};

use anyhow::{Result, anyhow};
use db::DBService;
use sqlx::Row;
use tokio::{
    sync::Mutex,
    task::JoinHandle,
    time::{Duration, timeout},
};
use tracing::{debug, error, info, warn};

use super::{
    OrchestratorAgent, OrchestratorConfig, SharedMessageBus,
    constants::{WORKFLOW_STATUS_FAILED, WORKFLOW_STATUS_READY},
    persistence::StatePersistence,
};
use crate::services::git_watcher::{GitWatcher, GitWatcherConfig};

/// Configuration for the OrchestratorRuntime
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    /// Maximum number of concurrent workflows
    pub max_concurrent_workflows: usize,
    /// Message bus channel capacity
    pub message_bus_capacity: usize,
    /// Git watcher polling interval in milliseconds
    pub git_watch_poll_interval_ms: u64,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            max_concurrent_workflows: 10,
            message_bus_capacity: 1000,
            git_watch_poll_interval_ms: 2000,
        }
    }
}

/// Workflow agent with its task handle
struct RunningWorkflow {
    agent: Arc<OrchestratorAgent>,
    task_handle: JoinHandle<()>,
}

/// Git watcher with its task handle for lifecycle management
struct GitWatcherHandle {
    watcher: Arc<GitWatcher>,
    task_handle: JoinHandle<()>,
}

/// Orchestrator Runtime Service
///
/// Manages the lifecycle of orchestrator agents for multiple workflows.
#[derive(Clone)]
pub struct OrchestratorRuntime {
    db: Arc<DBService>,
    message_bus: SharedMessageBus,
    config: RuntimeConfig,
    running_workflows: Arc<Mutex<HashMap<String, RunningWorkflow>>>,
    /// Git watchers for each workflow, keyed by workflow_id
    git_watchers: Arc<Mutex<HashMap<String, GitWatcherHandle>>>,
    persistence: StatePersistence,
}

impl OrchestratorRuntime {
    /// Create a new runtime instance
    pub fn new(db: Arc<DBService>, message_bus: SharedMessageBus) -> Self {
        let persistence = StatePersistence::new(db.clone());

        Self {
            db,
            message_bus,
            config: RuntimeConfig::default(),
            running_workflows: Arc::new(Mutex::new(HashMap::new())),
            git_watchers: Arc::new(Mutex::new(HashMap::new())),
            persistence,
        }
    }

    /// Create a new runtime with custom config
    pub fn with_config(
        db: Arc<DBService>,
        message_bus: SharedMessageBus,
        config: RuntimeConfig,
    ) -> Self {
        let persistence = StatePersistence::new(db.clone());

        Self {
            db,
            message_bus,
            config,
            running_workflows: Arc::new(Mutex::new(HashMap::new())),
            git_watchers: Arc::new(Mutex::new(HashMap::new())),
            persistence,
        }
    }

    /// Try to start a GitWatcher for the workflow.
    ///
    /// Returns None if:
    /// - Project not found
    /// - Project has no default_agent_working_dir
    /// - Path is not a valid git repository
    async fn try_start_git_watcher(
        &self,
        workflow_id: &str,
        workflow: &db::models::Workflow,
    ) -> Result<Option<GitWatcherHandle>> {
        // Get project to find repo path
        let project =
            match db::models::project::Project::find_by_id(&self.db.pool, workflow.project_id)
                .await?
            {
                Some(project) => project,
                None => {
                    warn!(
                        "Project {} not found for workflow {}, git watcher disabled",
                        workflow.project_id, workflow_id
                    );
                    return Ok(None);
                }
            };

        // Get repo path from project
        let Some(repo_path) = project.default_agent_working_dir.clone() else {
            warn!(
                "Project {} has no default_agent_working_dir; git watcher disabled for workflow {}",
                project.id, workflow_id
            );
            return Ok(None);
        };

        // Create GitWatcher config
        let config = GitWatcherConfig::new(
            PathBuf::from(&repo_path),
            self.config.git_watch_poll_interval_ms,
        );

        // Create GitWatcher
        let mut watcher = match GitWatcher::new(config, self.message_bus.as_ref().clone()) {
            Ok(watcher) => watcher,
            Err(e) => {
                warn!(
                    "Failed to create GitWatcher for workflow {} (repo {}): {}",
                    workflow_id, repo_path, e
                );
                return Ok(None);
            }
        };

        // Associate watcher with workflow
        watcher.set_workflow_id(workflow_id.to_string());

        let watcher = Arc::new(watcher);
        let watcher_clone = watcher.clone();
        let workflow_id_owned = workflow_id.to_string();

        // Spawn watcher task
        let task_handle = tokio::spawn(async move {
            if let Err(e) = watcher_clone.watch().await {
                error!(
                    "GitWatcher failed for workflow {}: {}",
                    workflow_id_owned, e
                );
            }
        });

        info!(
            "GitWatcher started for workflow {} (repo: {})",
            workflow_id, repo_path
        );

        Ok(Some(GitWatcherHandle {
            watcher,
            task_handle,
        }))
    }

    /// Stop the GitWatcher for a workflow if running.
    async fn stop_git_watcher(&self, workflow_id: &str) {
        let git_watcher_handle = {
            let mut watchers = self.git_watchers.lock().await;
            watchers.remove(workflow_id)
        };

        if let Some(handle) = git_watcher_handle {
            // Signal watcher to stop
            handle.watcher.stop();
            info!("GitWatcher stop requested for workflow {}", workflow_id);

            // Wait for graceful shutdown with timeout
            let mut task_handle = handle.task_handle;
            let shutdown_result = timeout(Duration::from_secs(5), &mut task_handle).await;

            match shutdown_result {
                Ok(Ok(())) => {
                    info!(
                        "GitWatcher for workflow {} shutdown gracefully",
                        workflow_id
                    );
                }
                Ok(Err(e)) => {
                    warn!(
                        "GitWatcher task failed for workflow {}: {:?}",
                        workflow_id, e
                    );
                }
                Err(_) => {
                    warn!(
                        "GitWatcher shutdown timeout for workflow {}, aborting",
                        workflow_id
                    );
                    task_handle.abort();
                    task_handle.await.ok();
                }
            }
        }
    }

    /// Start orchestrating a workflow
    ///
    /// Creates and starts an OrchestratorAgent for the given workflow.
    /// Returns an error if the workflow is already running or if the
    /// max_concurrent_workflows limit is reached.
    pub async fn start_workflow(&self, workflow_id: &str) -> Result<()> {
        // Check concurrent workflow limit and if already running
        {
            let running = self.running_workflows.lock().await;
            if running.len() >= self.config.max_concurrent_workflows {
                return Err(anyhow!(
                    "Maximum concurrent workflows limit reached: {}",
                    self.config.max_concurrent_workflows
                ));
            }

            if running.contains_key(workflow_id) {
                return Err(anyhow!("Workflow {} is already running", workflow_id));
            }
        }

        // Load workflow from database
        let workflow = db::models::Workflow::find_by_id(&self.db.pool, workflow_id)
            .await?
            .ok_or_else(|| anyhow!("Workflow {} not found", workflow_id))?;

        // Verify workflow is in ready state
        if workflow.status != WORKFLOW_STATUS_READY {
            return Err(anyhow!(
                "Workflow {} is not ready. Current status: {}",
                workflow_id,
                workflow.status
            ));
        }

        // Build orchestrator config from workflow settings
        let orchestrator_config = if workflow.orchestrator_enabled {
            // Decrypt API key if needed
            let api_key = workflow
                .get_api_key()?
                .ok_or_else(|| anyhow!("Orchestrator API key not configured"))?;

            Some(
                OrchestratorConfig::from_workflow(
                    workflow.orchestrator_api_type.as_deref(),
                    workflow.orchestrator_base_url.as_deref(),
                    Some(&api_key),
                    workflow.orchestrator_model.as_deref(),
                )
                .ok_or_else(|| anyhow!("Invalid orchestrator configuration"))?,
            )
        } else {
            None
        };

        // Create orchestrator agent FIRST before changing status
        let config = orchestrator_config.unwrap_or_default();
        let agent = match OrchestratorAgent::new(
            config,
            workflow_id.to_string(),
            self.message_bus.clone(),
            self.db.clone(),
        ) {
            Ok(agent) => Arc::new(agent),
            Err(e) => {
                // Agent creation failed, workflow stays in ready state
                error!(
                    "Failed to create orchestrator agent for workflow {}: {}",
                    workflow_id, e
                );
                return Err(e.context("Failed to create orchestrator agent"));
            }
        };

        // Update workflow status to running AFTER agent is successfully created
        db::models::Workflow::set_started(&self.db.pool, workflow_id).await?;
        info!("Workflow {} marked as started", workflow_id);

        // Spawn agent task with error handling
        let agent_clone = agent.clone();
        let workflow_id_owned = workflow_id.to_string();
        let task_handle = tokio::spawn(async move {
            if let Err(e) = agent_clone.run().await {
                error!(
                    "Orchestrator agent failed for workflow {}: {}",
                    workflow_id_owned, e
                );
            }
        });

        // Insert into running workflows map immediately to prevent race condition
        let mut running = self.running_workflows.lock().await;
        running.insert(
            workflow_id.to_string(),
            RunningWorkflow { agent, task_handle },
        );
        drop(running); // Release lock before logging

        // Start GitWatcher for this workflow (non-blocking, failure is not fatal)
        match self.try_start_git_watcher(workflow_id, &workflow).await {
            Ok(Some(handle)) => {
                let mut watchers = self.git_watchers.lock().await;
                watchers.insert(workflow_id.to_string(), handle);
            }
            Ok(None) => {
                // GitWatcher not started (no repo path or invalid repo)
                debug!(
                    "GitWatcher not started for workflow {} (no valid repo)",
                    workflow_id
                );
            }
            Err(e) => {
                warn!(
                    "Failed to start GitWatcher for workflow {}: {}",
                    workflow_id, e
                );
            }
        }

        info!("Workflow {} started successfully", workflow_id);
        let running = self.running_workflows.lock().await;
        debug!("Total running workflows: {}", running.len());

        Ok(())
    }

    /// Stop orchestrating a workflow
    ///
    /// Sends shutdown signal to the agent and waits for graceful shutdown.
    /// If shutdown doesn't complete within timeout, the task is aborted.
    pub async fn stop_workflow(&self, workflow_id: &str) -> Result<()> {
        // Stop GitWatcher first (non-blocking)
        self.stop_git_watcher(workflow_id).await;

        // Remove from running workflows
        let running_workflow = {
            let mut running = self.running_workflows.lock().await;
            running
                .remove(workflow_id)
                .ok_or_else(|| anyhow!("Workflow {} is not running", workflow_id))?
        };

        // Send shutdown signal via message bus
        self.message_bus
            .publish(
                &format!("workflow:{}", workflow_id),
                super::BusMessage::Shutdown,
            )
            .await?;

        info!("Shutdown signal sent for workflow {}", workflow_id);

        // Wait for graceful shutdown (5 second timeout)
        let mut task_handle = running_workflow.task_handle;
        let shutdown_result = timeout(Duration::from_secs(5), &mut task_handle).await;

        match shutdown_result {
            Ok(Ok(())) => {
                info!("Workflow {} shutdown gracefully", workflow_id);
            }
            Ok(Err(e)) => {
                warn!("Workflow {} task failed: {:?}", workflow_id, e);
            }
            Err(_) => {
                warn!("Workflow {} shutdown timeout, aborting", workflow_id);
                task_handle.abort();
                task_handle.await.ok(); // Await the abort
            }
        }

        info!("Workflow {} stopped successfully", workflow_id);

        let running = self.running_workflows.lock().await;
        debug!("Total running workflows: {}", running.len());

        Ok(())
    }

    /// Check if a workflow is currently running
    pub async fn is_running(&self, workflow_id: &str) -> bool {
        let running = self.running_workflows.lock().await;
        running.contains_key(workflow_id)
    }

    /// Get the count of running workflows
    pub async fn running_count(&self) -> usize {
        let running = self.running_workflows.lock().await;
        running.len()
    }

    /// Stop all running workflows
    pub async fn stop_all(&self) -> Result<()> {
        let workflow_ids: Vec<String> = {
            let running = self.running_workflows.lock().await;
            running.keys().cloned().collect()
        };

        info!("Stopping {} running workflows", workflow_ids.len());

        for workflow_id in workflow_ids {
            if let Err(e) = self.stop_workflow(&workflow_id).await {
                warn!("Failed to stop workflow {}: {}", workflow_id, e);
            }
        }

        info!("All workflows stopped");

        Ok(())
    }

    /// Recover workflows that were running at startup
    ///
    /// Finds all workflows with status 'running' and marks them as 'failed',
    /// as they were likely interrupted by a crash or restart.
    /// Should be called on service startup.
    pub async fn recover_running_workflows(&self) -> Result<()> {
        // Query for workflows with status 'running'
        // Note: We need to add this method to Workflow model, but for now use a workaround
        let pool = &self.db.pool;

        // Direct SQL query to find running workflows
        let rows = sqlx::query(
            r#"
            SELECT id
            FROM workflow
            WHERE status = 'running'
            "#,
        )
        .fetch_all(pool)
        .await?;

        if rows.is_empty() {
            info!("No running workflows to recover");
            return Ok(());
        }

        warn!("Found {} running workflows to recover", rows.len());

        for row in rows {
            let workflow_id: String = row.get("id");
            warn!("Recovering workflow {}", workflow_id);

            // Try to load persisted state
            match self.persistence.recover_workflow(&workflow_id).await {
                Ok(Some(state)) => {
                    info!(
                        "Successfully recovered state for workflow {} with {} tasks and {} messages",
                        workflow_id,
                        state.task_states.len(),
                        state.conversation_history.len()
                    );

                    // For now, we mark the workflow as failed since we can't automatically
                    // resume without more complex recovery logic
                    // In the future, this could restart the workflow with the recovered state
                    if let Err(e) = db::models::Workflow::update_status(
                        pool,
                        &workflow_id,
                        WORKFLOW_STATUS_FAILED,
                    )
                    .await
                    {
                        error!(
                            "Failed to mark workflow {} as failed during recovery: {}",
                            workflow_id, e
                        );
                    } else {
                        info!(
                            "Workflow {} marked as failed (state recovered but auto-resume not implemented)",
                            workflow_id
                        );
                    }
                }
                Ok(None) => {
                    warn!("No persisted state found for workflow {}", workflow_id);

                    // Mark as failed since we can't recover without state
                    if let Err(e) = db::models::Workflow::update_status(
                        pool,
                        &workflow_id,
                        WORKFLOW_STATUS_FAILED,
                    )
                    .await
                    {
                        error!(
                            "Failed to mark workflow {} as failed during recovery: {}",
                            workflow_id, e
                        );
                    } else {
                        info!(
                            "Workflow {} marked as failed (no state recovered)",
                            workflow_id
                        );
                    }
                }
                Err(e) => {
                    error!(
                        "Failed to recover state for workflow {}: {}",
                        workflow_id, e
                    );

                    // Still mark as failed even if state recovery failed
                    if let Err(e) = db::models::Workflow::update_status(
                        pool,
                        &workflow_id,
                        WORKFLOW_STATUS_FAILED,
                    )
                    .await
                    {
                        error!(
                            "Failed to mark workflow {} as failed during recovery: {}",
                            workflow_id, e
                        );
                    }
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Note: Tests are in runtime_test.rs
}
