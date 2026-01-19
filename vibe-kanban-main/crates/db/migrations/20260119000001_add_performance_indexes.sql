-- ============================================================================
-- GitCortex Performance Indexes Migration
-- Created: 2026-01-19
-- Description: Add composite and partial indexes for workflow query optimization
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Workflow Table Indexes
-- ----------------------------------------------------------------------------

-- Index for finding active workflows by project (most common query)
-- Optimizes: SELECT * FROM workflow WHERE project_id = ? AND status IN ('created', 'ready', 'running')
CREATE INDEX IF NOT EXISTS idx_workflow_project_status
ON workflow(project_id, status)
WHERE status IN ('created', 'ready', 'running');

-- Index for listing active workflows sorted by creation time
-- Optimizes: SELECT * FROM workflow WHERE status NOT IN ('completed', 'failed', 'cancelled') ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_workflow_active
ON workflow(status, created_at DESC)
WHERE status NOT IN ('completed', 'failed', 'cancelled');

-- Index for cleanup operations on completed workflows
-- Optimizes: DELETE FROM workflow WHERE project_id = ? AND status IN ('completed', 'failed', 'cancelled') AND completed_at < ?
CREATE INDEX IF NOT EXISTS idx_workflow_completed_cleanup
ON workflow(project_id, completed_at)
WHERE status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Workflow Task Table Indexes
-- ----------------------------------------------------------------------------

-- Index for finding tasks by workflow with status filtering
-- Optimizes: SELECT * FROM workflow_task WHERE workflow_id = ? AND status IN ('pending', 'running', 'review_pending') ORDER BY order_index
CREATE INDEX IF NOT EXISTS idx_workflow_task_workflow_status
ON workflow_task(workflow_id, status, order_index);

-- Index for finding active tasks across all workflows
-- Optimizes: SELECT * FROM workflow_task WHERE status IN ('pending', 'running', 'review_pending') ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_workflow_task_active
ON workflow_task(status, created_at)
WHERE status IN ('pending', 'running', 'review_pending');

-- ----------------------------------------------------------------------------
-- Terminal Table Indexes
-- ----------------------------------------------------------------------------

-- Index for finding terminals by task with status filtering
-- Optimizes: SELECT * FROM terminal WHERE workflow_task_id = ? AND status IN ('starting', 'waiting', 'working') ORDER BY order_index
CREATE INDEX IF NOT EXISTS idx_terminal_task_status
ON terminal(workflow_task_id, status, order_index);

-- Index for finding active terminals across all tasks
-- Optimizes: SELECT * FROM terminal WHERE status IN ('starting', 'waiting', 'working') ORDER BY started_at
CREATE INDEX IF NOT EXISTS idx_terminal_active
ON terminal(status, started_at)
WHERE status IN ('starting', 'waiting', 'working');

-- Index for cleanup operations on completed terminals
-- Optimizes: DELETE FROM terminal WHERE workflow_task_id = ? AND status IN ('completed', 'failed', 'cancelled') AND completed_at < ?
CREATE INDEX IF NOT EXISTS idx_terminal_cleanup
ON terminal(workflow_task_id, completed_at)
WHERE status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Git Event Table Indexes
-- ----------------------------------------------------------------------------

-- Index for processing pending events by workflow
-- Optimizes: SELECT * FROM git_event WHERE workflow_id = ? AND process_status IN ('pending', 'processing') ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_git_event_workflow_status
ON git_event(workflow_id, process_status, created_at)
WHERE process_status IN ('pending', 'processing');

-- Index for processing pending events by terminal
-- Optimizes: SELECT * FROM git_event WHERE terminal_id = ? AND process_status = 'pending' ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_git_event_terminal_status
ON git_event(terminal_id, process_status, created_at)
WHERE process_status = 'pending';

-- Index for cleanup of processed events
-- Optimizes: DELETE FROM git_event WHERE workflow_id = ? AND process_status = 'processed' AND processed_at < ?
CREATE INDEX IF NOT EXISTS idx_git_event_cleanup
ON git_event(workflow_id, processed_at)
WHERE process_status = 'processed' AND processed_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Terminal Log Table Indexes
-- ----------------------------------------------------------------------------

-- Index for streaming recent logs (last 1 hour)
-- Optimizes: SELECT * FROM terminal_log WHERE terminal_id = ? AND created_at > datetime('now', '-1 hour') ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_terminal_log_streaming
ON terminal_log(terminal_id, created_at DESC)
WHERE created_at > datetime('now', '-1 hour');

-- Index for cleanup of old logs (older than 7 days)
-- Optimizes: DELETE FROM terminal_log WHERE created_at < datetime('now', '-7 days')
CREATE INDEX IF NOT EXISTS idx_terminal_log_cleanup
ON terminal_log(created_at)
WHERE created_at < datetime('now', '-7 days');

-- ----------------------------------------------------------------------------
-- Update Table Statistics
-- ----------------------------------------------------------------------------

-- Analyze all tables to update query planner statistics
ANALYZE workflow;
ANALYZE workflow_task;
ANALYZE workflow_command;
ANALYZE terminal;
ANALYZE terminal_log;
ANALYZE git_event;
ANALYZE cli_type;
ANALYZE model_config;
ANALYZE slash_command_preset;
