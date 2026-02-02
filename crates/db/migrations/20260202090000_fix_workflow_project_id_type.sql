-- ============================================================================
-- Fix workflow.project_id type to match projects.id (BLOB)
-- Created: 2026-02-02
-- Description: The workflow table was created with project_id as TEXT,
--              but projects.id is BLOB (UUID). This causes FOREIGN KEY
--              constraint failures. This migration fixes the type mismatch.
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- Recreate workflow table with correct project_id type
CREATE TABLE workflow_new (
    id                      TEXT PRIMARY KEY,
    project_id              BLOB NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    description             TEXT,
    status                  TEXT NOT NULL DEFAULT 'created',
    use_slash_commands      INTEGER NOT NULL DEFAULT 0,
    orchestrator_enabled    INTEGER NOT NULL DEFAULT 1,
    orchestrator_api_type   TEXT,
    orchestrator_base_url   TEXT,
    orchestrator_api_key    TEXT,
    orchestrator_model      TEXT,
    error_terminal_enabled  INTEGER NOT NULL DEFAULT 0,
    error_terminal_cli_id   TEXT REFERENCES cli_type(id),
    error_terminal_model_id TEXT REFERENCES model_config(id),
    merge_terminal_cli_id   TEXT NOT NULL REFERENCES cli_type(id),
    merge_terminal_model_id TEXT NOT NULL REFERENCES model_config(id),
    target_branch           TEXT NOT NULL DEFAULT 'main',
    ready_at                TEXT,
    started_at              TEXT,
    completed_at            TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Copy existing data (if any)
INSERT INTO workflow_new (
    id, project_id, name, description, status,
    use_slash_commands, orchestrator_enabled,
    orchestrator_api_type, orchestrator_base_url,
    orchestrator_api_key, orchestrator_model,
    error_terminal_enabled, error_terminal_cli_id, error_terminal_model_id,
    merge_terminal_cli_id, merge_terminal_model_id,
    target_branch, ready_at, started_at, completed_at,
    created_at, updated_at
)
SELECT
    id, project_id, name, description, status,
    use_slash_commands, orchestrator_enabled,
    orchestrator_api_type, orchestrator_base_url,
    orchestrator_api_key, orchestrator_model,
    error_terminal_enabled, error_terminal_cli_id, error_terminal_model_id,
    merge_terminal_cli_id, merge_terminal_model_id,
    target_branch, ready_at, started_at, completed_at,
    created_at, updated_at
FROM workflow;

-- Drop old table and rename new one
DROP TABLE workflow;
ALTER TABLE workflow_new RENAME TO workflow;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_workflow_project_id ON workflow(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow(status);
CREATE INDEX IF NOT EXISTS idx_workflow_project_created ON workflow(project_id, created_at DESC);

PRAGMA foreign_keys = ON;
