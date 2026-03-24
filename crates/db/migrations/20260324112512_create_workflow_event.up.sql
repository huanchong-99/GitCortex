CREATE TABLE IF NOT EXISTS workflow_event (
    id          TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,
    summary     TEXT NOT NULL,
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_event_workflow_id ON workflow_event(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_event_created_at ON workflow_event(created_at);
