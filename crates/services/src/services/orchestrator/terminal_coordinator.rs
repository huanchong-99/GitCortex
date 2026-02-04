//! Terminal Coordinator
//!
//! Coordinates terminal preparation sequence without global config switching.
//! Configuration is now handled at spawn time via environment variable injection.

use std::sync::Arc;
use anyhow::Result;
use tracing::{info, error, instrument};

use db::{DBService, models::{workflow::WorkflowTask, terminal::Terminal}};

/// Terminal Coordinator
///
/// Manages the preparation sequence for terminals in a workflow.
/// Note: Model configuration is now handled at spawn time via `build_launch_config`
/// and environment variable injection, not by this coordinator.
pub struct TerminalCoordinator {
    db: Arc<DBService>,
}

impl TerminalCoordinator {
    /// Create a new terminal coordinator
    pub fn new(db: Arc<DBService>) -> Self {
        Self { db }
    }

    /// Prepare all terminals for a workflow
    ///
    /// Process:
    /// 1. Load all terminals for all tasks in the workflow
    /// 2. Transition all terminals to "waiting" status
    ///
    /// Note: Model configuration switching is no longer done here.
    /// It's handled at spawn time via `build_launch_config` for process-level isolation.
    ///
    /// # Arguments
    /// * `workflow_id` - The workflow ID to prepare terminals for
    ///
    /// # Returns
    /// * `Ok(())` if all terminals were successfully prepared
    /// * `Err(anyhow::Error)` if status update fails
    #[instrument(skip(self), fields(workflow_id))]
    pub async fn start_terminals_for_workflow(&self, workflow_id: &str) -> Result<()> {
        info!("Starting terminal preparation sequence for workflow");

        // Step 1: Load all tasks for the workflow
        let tasks = WorkflowTask::find_by_workflow(&self.db.pool, workflow_id).await?;

        if tasks.is_empty() {
            info!("No tasks found for workflow, skipping terminal preparation");
            return Ok(());
        }

        // Step 2: Load all terminals for all tasks
        let mut all_terminals = Vec::new();
        for task in &tasks {
            let terminals = Terminal::find_by_task(&self.db.pool, &task.id).await?;
            all_terminals.extend(terminals);
        }

        if all_terminals.is_empty() {
            info!("No terminals found for workflow, skipping terminal preparation");
            return Ok(());
        }

        info!(count = all_terminals.len(), "Found terminals to prepare");

        // Step 3: Transition terminals to "waiting" status
        // Note: Model switching is now done at spawn time via environment variables
        let mut prepared_terminals = Vec::new();
        for terminal in &all_terminals {
            info!(
                terminal_id = %terminal.id,
                cli_type_id = %terminal.cli_type_id,
                model_config_id = %terminal.model_config_id,
                "Preparing terminal (config will be applied at spawn time)"
            );

            if let Err(e) = Terminal::set_started(&self.db.pool, &terminal.id).await {
                error!(
                    terminal_id = %terminal.id,
                    error = %e,
                    "Failed to mark terminal as waiting"
                );
                return Err(anyhow::anyhow!(
                    "Failed to mark terminal as waiting {}: {}",
                    terminal.id,
                    e
                ));
            }

            prepared_terminals.push(terminal.id.clone());
            info!(terminal_id = %terminal.id, "Terminal transitioned to waiting status");
        }

        info!(
            workflow_id = %workflow_id,
            count = prepared_terminals.len(),
            "All terminals successfully prepared"
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests are in terminal_coordinator_test.rs
    // This module is for any unit tests that don't need full database setup
}
