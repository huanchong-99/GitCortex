#!/usr/bin/env python
# Script to fix auto_dispatch_initial_tasks in agent.rs
import re

path = r'crates/services/src/services/orchestrator/agent.rs'
content = open(path, 'r', encoding='utf-8').read()

# Find the start of the function including its doc comment
start_marker = '    /// Auto-dispatches the first terminal for each task when workflow starts.'
end_marker = '    /// Publish any provider state-change events collected during the last LLM call.'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1:
    print('START MARKER NOT FOUND')
    exit(1)
if end_idx == -1:
    print('END MARKER NOT FOUND')
    exit(1)

print(f'Replacing from {start_idx} to {end_idx}')

old_section = content[start_idx:end_idx]
print(f'Old section length: {len(old_section)}')
print(f'Old section starts with: {repr(old_section[:80])}')
print(f'Old section ends with: {repr(old_section[-80:])}')

new_section = '''    /// Auto-dispatches the first terminal for each task when workflow starts.
    ///
    /// This method is called after the workflow enters running state to automatically
    /// start execution of all tasks by dispatching their first terminals.
    ///
    /// # G03-005: Parallel dispatch via join_all
    ///
    /// Phase 1 (sequential): Load task data, initialize shared state, and build
    /// dispatch payloads. State initialization must be sequential because it holds
    /// a write lock on self.state.
    ///
    /// Phase 2 (parallel): Dispatch all collected terminals concurrently using
    /// `futures::future::join_all`. Individual dispatch failures are logged but
    /// do not abort other dispatches.
    async fn auto_dispatch_initial_tasks(&self) -> anyhow::Result<()> {
        let workflow_id = {
            let state = self.state.read().await;
            state.workflow_id.clone()
        };

        // Get all tasks for this workflow
        let tasks = db::models::WorkflowTask::find_by_workflow(&self.db.pool, &workflow_id)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to get workflow tasks: {e}"))?;

        if tasks.is_empty() {
            tracing::info!(
                "No tasks found for workflow {}, skipping auto-dispatch",
                workflow_id
            );
            return Ok(());
        }

        tracing::info!(
            "Auto-dispatching initial terminals for {} tasks in workflow {}",
            tasks.len(),
            workflow_id
        );

        // Phase 1 (sequential): build the list of (task_id, terminal, instruction) to dispatch.
        // State initialization requires the write lock, so this must remain sequential.
        let mut dispatch_queue: Vec<(String, db::models::Terminal, String)> = Vec::new();

        for task in tasks {
            // Skip tasks that are already completed, failed, or cancelled
            if task.status == TASK_STATUS_COMPLETED
                || task.status == TASK_STATUS_FAILED
                || task.status == TASK_STATUS_CANCELLED
            {
                tracing::debug!("Skipping task {} due to status {}", task.id, task.status);
                continue;
            }

            // Get terminals for this task
            let terminals = db::models::Terminal::find_by_task(&self.db.pool, &task.id)
                .await
                .map_err(|e| {
                    anyhow::anyhow!("Failed to get terminals for task {}: {e}", task.id)
                })?;

            if terminals.is_empty() {
                tracing::warn!("No terminals found for task {}, skipping", task.id);
                continue;
            }

            // Initialize task state (requires write lock -- must stay sequential)
            {
                let mut state = self.state.write().await;
                if state.task_states.contains_key(&task.id) {
                    state.sync_task_terminals(
                        task.id.clone(),
                        terminals.iter().map(|terminal| terminal.id.clone()).collect(),
                        true,
                    );
                } else {
                    state.init_task(
                        task.id.clone(),
                        terminals.iter().map(|terminal| terminal.id.clone()).collect(),
                    );
                }
            }

            // Get next terminal index (should be 0 for initial dispatch)
            let next_index = {
                let state = self.state.read().await;
                state.get_next_terminal_for_task(&task.id)
            };

            let Some(index) = next_index else {
                tracing::debug!("No pending terminals for task {}", task.id);
                continue;
            };

            let Some(terminal) = terminals.get(index).cloned() else {
                tracing::warn!("Terminal index {} out of range for task {}", index, task.id);
                continue;
            };

            // Only dispatch terminals in waiting status
            if terminal.status != TERMINAL_STATUS_WAITING {
                tracing::debug!(
                    "Skipping terminal {} for task {} due to status {}",
                    terminal.id,
                    task.id,
                    terminal.status
                );
                continue;
            }

            // Build instruction and enqueue for parallel dispatch
            let instruction =
                Self::build_task_instruction(&workflow_id, &task, &terminal, terminals.len(), None);
            dispatch_queue.push((task.id.clone(), terminal, instruction));
        }

        if dispatch_queue.is_empty() {
            return Ok(());
        }

        tracing::info!(
            "Phase 2: dispatching {} terminals in parallel",
            dispatch_queue.len()
        );

        // Phase 2 (parallel): dispatch all collected terminals concurrently.
        // G03-005: join_all reduces startup latency when there are many tasks.
        let dispatch_futures: Vec<_> = dispatch_queue
            .iter()
            .map(|(task_id, terminal, instruction)| {
                self.dispatch_terminal(task_id, terminal, instruction)
            })
            .collect();

        let results = futures::future::join_all(dispatch_futures).await;
        for (result, (task_id, terminal, _)) in results.into_iter().zip(dispatch_queue.iter()) {
            if let Err(e) = result {
                tracing::error!(
                    "Failed to auto-dispatch terminal {} for task {}: {}",
                    terminal.id,
                    task_id,
                    e
                );
                // Continue -- other tasks' dispatches are unaffected
            }
        }

        Ok(())
    }

'''

new_content = content[:start_idx] + new_section + content[end_idx:]
open(path, 'w', encoding='utf-8').write(new_content)
print(f'SUCCESS: replaced auto_dispatch_initial_tasks ({len(old_section)} -> {len(new_section)} chars)')
