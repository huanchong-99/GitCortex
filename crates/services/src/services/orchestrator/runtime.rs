//! Orchestrator Runtime Service
//!
//! Manages multiple OrchestratorAgent instances, one per active workflow.

use std::collections::HashMap;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time::{timeout, Duration};
use tracing::{debug, error, info, warn};

use super::{
    constants::{WORKFLOW_STATUS_FAILED, WORKFLOW_STATUS_READY},
    OrchestratorAgent, OrchestratorConfig, SharedMessageBus,
    persistence::StatePersistence,
};
use db::DBService;
use sqlx::Row;

/// Configuration for the OrchestratorRuntime
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    /// Maximum number of concurrent workflows
    pub max_concurrent_workflows: usize,
    /// Message bus channel capacity
    pub message_bus_capacity: usize,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            max_concurrent_workflows: 10,
            message_bus_capacity: 1000,
        }
    }
}

/// Workflow agent with its task handle
struct RunningWorkflow {
    agent: Arc<OrchestratorAgent>,
    task_handle: JoinHandle<()>,
}

/// Orchestrator Runtime Service
///
/// Manages the lifecycle of orchestrator agents for multiple workflows.
pub struct OrchestratorRuntime {
    db: Arc<DBService>,
    message_bus: SharedMessageBus,
    config: RuntimeConfig,
    running_workflows: Arc<Mutex<HashMap<String, RunningWorkflow>>>,
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
            persistence,
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

            Some(OrchestratorConfig::from_workflow(
                workflow.orchestrator_api_type.as_deref(),
                workflow.orchestrator_base_url.as_deref(),
                Some(&api_key),
                workflow.orchestrator_model.as_deref(),
            ).ok_or_else(|| anyhow!("Invalid orchestrator configuration"))?)
        } else {
            None
        };

        // Update workflow status to running
        db::models::Workflow::set_started(&self.db.pool, workflow_id).await?;
        info!("Workflow {} marked as started", workflow_id);

        // Create orchestrator agent
        let config = orchestrator_config.unwrap_or_default();
        let agent = Arc::new(OrchestratorAgent::new(
            config,
            workflow_id.to_string(),
            self.message_bus.clone(),
            self.db.clone(),
        )?);

        // Spawn agent task
        let agent_clone = agent.clone();
        let task_handle = tokio::spawn(async move {
            if let Err(e) = agent_clone.run().await {
                error!("Orchestrator agent failed for workflow {}: {}", workflow_id, e);
            }
        });

        // Insert into running workflows map immediately to prevent race condition
        let mut running = self.running_workflows.lock().await;
        running.insert(
            workflow_id.to_string(),
            RunningWorkflow {
                agent,
                task_handle,
            },
        );
        drop(running); // Release lock before logging

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
        // Remove from running workflows
        let running_workflow = {
            let mut running = self.running_workflows.lock().await;
            running.remove(workflow_id)
                .ok_or_else(|| anyhow!("Workflow {} is not running", workflow_id))?
        };

        // Send shutdown signal via message bus
        self.message_bus
            .publish(&format!("workflow:{}", workflow_id), super::BusMessage::Shutdown)
            .await?;

        info!("Shutdown signal sent for workflow {}", workflow_id);

        // Wait for graceful shutdown (5 second timeout)
        let shutdown_result = timeout(Duration::from_secs(5), running_workflow.task_handle).await;

        match shutdown_result {
            Ok(Ok(())) => {
                info!("Workflow {} shutdown gracefully", workflow_id);
            }
            Ok(Err(e)) => {
                warn!("Workflow {} task failed: {:?}", workflow_id, e);
            }
            Err(_) => {
                warn!("Workflow {} shutdown timeout, aborting", workflow_id);
                running_workflow.task_handle.abort();
                running_workflow.task_handle.await.ok(); // Await the abort
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
            "#
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
                        info!("Workflow {} marked as failed (state recovered but auto-resume not implemented)", workflow_id);
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
                        info!("Workflow {} marked as failed (no state recovered)", workflow_id);
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
