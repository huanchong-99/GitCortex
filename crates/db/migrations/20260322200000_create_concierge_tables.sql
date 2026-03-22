-- Concierge Agent: shared conversation sessions across Feishu and Web UI.
-- A session can be bound to multiple channels (feishu chat, web client).
-- All messages are stored in a single stream, enabling bidirectional sync.

CREATE TABLE concierge_session (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    active_project_id TEXT REFERENCES projects(id),
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

CREATE TABLE concierge_session_channel (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES concierge_session(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    user_identifier TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, external_id)
);

CREATE TABLE concierge_message (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES concierge_session(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    source_provider TEXT,
    source_user TEXT,
    tool_name TEXT,
    tool_call_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_concierge_msg_session ON concierge_message(session_id, created_at);
CREATE INDEX idx_concierge_channel_session ON concierge_session_channel(session_id);
