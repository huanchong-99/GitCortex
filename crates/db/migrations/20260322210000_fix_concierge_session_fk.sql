-- Fix: Remove FOREIGN KEY on active_project_id because projects.id is BLOB (Uuid)
-- but concierge_session.active_project_id is TEXT. SQLite FK type mismatch causes
-- constraint failures on every update. Use plain TEXT field instead (like active_workflow_id).

-- SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate the table.
CREATE TABLE concierge_session_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    active_project_id TEXT,
    active_workflow_id TEXT,
    active_planning_draft_id TEXT,
    feishu_sync INTEGER NOT NULL DEFAULT 0,
    progress_notifications INTEGER NOT NULL DEFAULT 0,
    llm_model_id TEXT,
    llm_api_type TEXT,
    llm_base_url TEXT,
    llm_api_key_encrypted TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO concierge_session_new (id, name, active_project_id, active_workflow_id, active_planning_draft_id, feishu_sync, progress_notifications, llm_model_id, llm_api_type, llm_base_url, llm_api_key_encrypted, created_at, updated_at)
SELECT id, name, active_project_id, active_workflow_id, active_planning_draft_id, feishu_sync, progress_notifications, llm_model_id, llm_api_type, llm_base_url, llm_api_key_encrypted, created_at, updated_at FROM concierge_session;
DROP TABLE concierge_session;
ALTER TABLE concierge_session_new RENAME TO concierge_session;
