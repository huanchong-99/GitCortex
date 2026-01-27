//! Terminal Coordinator
//!
//! Coordinates terminal startup sequence with serial model switching.

use std::sync::Arc;
use anyhow::Result;
use tracing::{info, error, instrument};

use db::{DBService, models::{workflow::WorkflowTask, terminal::Terminal}};
use crate::services::cc_switch::CCSwitch;

/// Terminal Coordinator
///
/// Manages the startup sequence for terminals in a workflow.
/// Performs serial model switching followed by parallel terminal execution.
pub struct TerminalCoordinator {
    db: Arc<DBService>,
    cc_switch: Arc<dyn CCSwitch>,
}

impl TerminalCoordinator {
    /// Create a new terminal coordinator
    pub fn new(db: Arc<DBService>, cc_switch: Arc<dyn CCSwitch>) -> Self {
        Self { db, cc_switch }
    }

    /// Start all terminals for a workflow
    ///
    /// Process:
    /// 1. Load all terminals for all tasks in the workflow
    /// 2. For each terminal serially: switch model using cc_switch
    /// 3. After all models switched: transition terminals to "waiting" status
    ///
    /// # Arguments
    /// * `workflow_id` - The workflow ID to start terminals for
    ///
    /// # Returns
    /// * `Ok(())` if all terminals were successfully started
    /// * `Err(anyhow::Error)` if model switching or status update fails
    #[instrument(skip(self), fields(workflow_id))]
    pub async fn start_terminals_for_workflow(&self, workflow_id: &str) -> Result<()> {
        info!("Starting terminal startup sequence for workflow");

        // Step 1: Load all tasks for the workflow
        let tasks = WorkflowTask::find_by_workflow(&self.db.pool, workflow_id).await?;

        if tasks.is_empty() {
            info!("No tasks found for workflow, skipping terminal startup");
            return Ok(());
        }

        // Step 2: Load all terminals for all tasks
        let mut all_terminals = Vec::new();
        for task in &tasks {
            let terminals = Terminal::find_by_task(&self.db.pool, &task.id).await?;
            all_terminals.extend(terminals);
        }

        if all_terminals.is_empty() {
            info!("No terminals found for workflow, skipping terminal startup");
            return Ok(());
        }

        info!(count = all_terminals.len(), "Found terminals to start");

        // Step 3: Switch models for each terminal serially
        let mut successfully_switched = Vec::new();
        for terminal in &all_terminals {
            info!(
                terminal_id = %terminal.id,
                cli_type_id = %terminal.cli_type_id,
                model_config_id = %terminal.model_config_id,
                "Switching model for terminal"
            );

            // Switch model configuration for this terminal
            if let Err(e) = self.cc_switch.switch_for_terminal(terminal).await {
                error!(
                    terminal_id = %terminal.id,
                    error = %e,
                    "Failed to switch model for terminal"
                );
                return Err(e.context(format!(
                    "Failed to switch model for terminal {}",
                    terminal.id
                )));
            }

            info!(terminal_id = %terminal.id, "Model switched successfully");
            successfully_switched.push(terminal.id.clone());
        }

        // Step 4: Transition only successfully switched terminals to "waiting" status
        for terminal_id in &successfully_switched {
            Terminal::set_started(&self.db.pool, terminal_id).await?;
            info!(terminal_id = %terminal_id, "Terminal transitioned to waiting status");
        }

        info!(
            workflow_id = %workflow_id,
            count = successfully_switched.len(),
            "All terminals successfully started"
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
