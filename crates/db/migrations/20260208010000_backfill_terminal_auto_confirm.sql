-- Backfill historical terminal auto_confirm values and align default behavior.
-- Phase 26.56

UPDATE terminal
SET auto_confirm = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE auto_confirm = 0;

-- NOTE: EXISTS subquery is acceptable here for a one-time migration to clean up orphaned foreign key references.
UPDATE terminal
SET vk_session_id = NULL
WHERE vk_session_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM sessions
      WHERE sessions.id = terminal.vk_session_id
  );

DROP INDEX IF EXISTS idx_terminal_auto_confirm;

ALTER TABLE terminal RENAME TO terminal_old;

CREATE TABLE terminal (
    id TEXT PRIMARY KEY NOT NULL,
    workflow_task_id TEXT NOT NULL,
    cli_type_id TEXT NOT NULL,
    model_config_id TEXT NOT NULL,
    custom_base_url TEXT,
    custom_api_key TEXT,
    role TEXT,
    role_description TEXT,
    order_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    process_id INTEGER,
    pty_session_id TEXT,
    session_id TEXT,
    execution_process_id TEXT,
    vk_session_id BLOB,
    auto_confirm INTEGER NOT NULL DEFAULT 1,
    last_commit_hash TEXT,
    last_commit_message TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (workflow_task_id) REFERENCES workflow_task(id) ON DELETE CASCADE,
    FOREIGN KEY (cli_type_id) REFERENCES cli_type(id),
    FOREIGN KEY (model_config_id) REFERENCES model_config(id),
    FOREIGN KEY (vk_session_id) REFERENCES sessions(id)
);

INSERT INTO terminal (
    id,
    workflow_task_id,
    cli_type_id,
    model_config_id,
    custom_base_url,
    custom_api_key,
    role,
    role_description,
    order_index,
    status,
    process_id,
    pty_session_id,
    session_id,
    execution_process_id,
    vk_session_id,
    auto_confirm,
    last_commit_hash,
    last_commit_message,
    started_at,
    completed_at,
    created_at,
    updated_at
)
SELECT
    id,
    workflow_task_id,
    cli_type_id,
    model_config_id,
    custom_base_url,
    custom_api_key,
    role,
    role_description,
    order_index,
    status,
    process_id,
    pty_session_id,
    session_id,
    execution_process_id,
    vk_session_id,
    auto_confirm,
    last_commit_hash,
    last_commit_message,
    started_at,
    completed_at,
    created_at,
    updated_at
FROM terminal_old;

DROP TABLE terminal_old;

CREATE INDEX idx_terminal_workflow_task_id ON terminal(workflow_task_id);
CREATE INDEX idx_terminal_status ON terminal(status);
CREATE INDEX idx_terminal_cli_type_id ON terminal(cli_type_id);
CREATE INDEX idx_terminal_task_status ON terminal(workflow_task_id, status, order_index);
CREATE INDEX idx_terminal_active ON terminal(status, started_at)
WHERE status IN ('starting', 'waiting', 'working');
CREATE INDEX idx_terminal_cleanup ON terminal(workflow_task_id, completed_at)
WHERE status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL;
CREATE INDEX idx_terminal_session_id ON terminal(session_id);
CREATE INDEX idx_terminal_auto_confirm ON terminal(auto_confirm);
CREATE INDEX idx_terminal_execution_process_id ON terminal(execution_process_id);
