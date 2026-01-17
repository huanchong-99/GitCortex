# Phase 1: Database Model Extension - TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend Vibe Kanban database with workflow coordination tables (9 tables) and create corresponding Rust models, DAO layer, and API routes.

**Architecture:**
- Add 9 new tables: cli_type, model_config, slash_command_preset, workflow, workflow_command, workflow_task, terminal, terminal_log, git_event
- Create Rust models with TypeScript export support using ts_rs
- Implement DAO layer following vibe-kanban patterns
- Create REST API routes using axum

**Tech Stack:**
- Database: SQLite with sqlx
- Backend: Rust (axum 0.8.4, sqlx, tokio, chrono, uuid, ts_rs)
- Frontend Types: Auto-generated TypeScript via ts_rs

---

## Task 1.1: Create Database Migration File

**Files:**
- Create: `vibe-kanban-main/crates/db/migrations/20260117000001_create_workflow_tables.sql`

**Step 1: Create the migration file with SQL DDL**

```bash
# Create migration file in vibe-kanban-main project
cat > "F:\Project\GitCortex\vibe-kanban-main\crates\db\migrations\20260117000001_create_workflow_tables.sql" << 'SQL_EOF'
-- ============================================================================
-- GitCortex Workflow Tables Migration
-- Created: 2026-01-17
-- Description: Add workflow coordination tables for multi-terminal orchestration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CLI Type Table (cli_type)
-- Stores supported AI coding agent CLI information
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cli_type (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,           -- Internal name, e.g., 'claude-code'
    display_name        TEXT NOT NULL,                  -- Display name, e.g., 'Claude Code'
    detect_command      TEXT NOT NULL,                  -- Detection command, e.g., 'claude --version'
    install_command     TEXT,                           -- Installation command (optional)
    install_guide_url   TEXT,                           -- Installation guide URL
    config_file_path    TEXT,                           -- Config file path template
    is_system           INTEGER NOT NULL DEFAULT 1,     -- Is system built-in
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert system built-in CLI types
INSERT INTO cli_type (id, name, display_name, detect_command, install_guide_url, config_file_path, is_system) VALUES
    ('cli-claude-code', 'claude-code', 'Claude Code', 'claude --version', 'https://docs.anthropic.com/en/docs/claude-code', '~/.claude/settings.json', 1),
    ('cli-gemini', 'gemini-cli', 'Gemini CLI', 'gemini --version', 'https://github.com/google-gemini/gemini-cli', '~/.gemini/.env', 1),
    ('cli-codex', 'codex', 'Codex', 'codex --version', 'https://github.com/openai/codex', '~/.codex/auth.json', 1),
    ('cli-amp', 'amp', 'Amp', 'amp --version', 'https://ampcode.com', NULL, 1),
    ('cli-cursor', 'cursor-agent', 'Cursor Agent', 'cursor --version', 'https://cursor.sh', NULL, 1),
    ('cli-qwen', 'qwen-code', 'Qwen Code', 'qwen --version', 'https://qwen.ai', NULL, 1),
    ('cli-copilot', 'copilot', 'GitHub Copilot', 'gh copilot --version', 'https://github.com/features/copilot', NULL, 1),
    ('cli-droid', 'droid', 'Droid', 'droid --version', 'https://droid.dev', NULL, 1),
    ('cli-opencode', 'opencode', 'Opencode', 'opencode --version', 'https://opencode.dev', NULL, 1);

-- ----------------------------------------------------------------------------
-- 2. Model Config Table (model_config)
-- Stores model configurations for each CLI
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS model_config (
    id              TEXT PRIMARY KEY,
    cli_type_id     TEXT NOT NULL REFERENCES cli_type(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,                      -- Model internal name, e.g., 'sonnet'
    display_name    TEXT NOT NULL,                      -- Display name, e.g., 'Claude Sonnet'
    api_model_id    TEXT,                               -- API model ID, e.g., 'claude-sonnet-4-20250514'
    is_default      INTEGER NOT NULL DEFAULT 0,         -- Is default model
    is_official     INTEGER NOT NULL DEFAULT 0,         -- Is official model
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(cli_type_id, name)
);

-- Insert Claude Code default models
INSERT INTO model_config (id, cli_type_id, name, display_name, api_model_id, is_default, is_official) VALUES
    ('model-claude-sonnet', 'cli-claude-code', 'sonnet', 'Claude Sonnet', 'claude-sonnet-4-20250514', 1, 1),
    ('model-claude-opus', 'cli-claude-code', 'opus', 'Claude Opus', 'claude-opus-4-5-20251101', 0, 1),
    ('model-claude-haiku', 'cli-claude-code', 'haiku', 'Claude Haiku', 'claude-haiku-4-5-20251001', 0, 1);

-- Insert Gemini default models
INSERT INTO model_config (id, cli_type_id, name, display_name, api_model_id, is_default, is_official) VALUES
    ('model-gemini-pro', 'cli-gemini', 'gemini-pro', 'Gemini Pro', 'gemini-2.5-pro', 1, 1),
    ('model-gemini-flash', 'cli-gemini', 'gemini-flash', 'Gemini Flash', 'gemini-2.5-flash', 0, 1);

-- Insert Codex default models
INSERT INTO model_config (id, cli_type_id, name, display_name, api_model_id, is_default, is_official) VALUES
    ('model-codex-gpt4o', 'cli-codex', 'gpt-4o', 'GPT-4o', 'gpt-4o', 1, 1),
    ('model-codex-o1', 'cli-codex', 'o1', 'O1', 'o1', 0, 1);

-- ----------------------------------------------------------------------------
-- 3. Slash Command Preset Table (slash_command_preset)
-- Stores reusable slash command presets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS slash_command_preset (
    id              TEXT PRIMARY KEY,
    command         TEXT NOT NULL UNIQUE,               -- Command name, e.g., '/write-code'
    description     TEXT NOT NULL,                      -- Command description
    prompt_template TEXT,                               -- Prompt template (optional)
    is_system       INTEGER NOT NULL DEFAULT 0,         -- Is system built-in
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert system built-in slash commands
INSERT INTO slash_command_preset (id, command, description, prompt_template, is_system) VALUES
    ('cmd-write-code', '/write-code', 'Write feature code', 'Please write code according to the following requirements:\n\n{requirement}\n\nRequirements:\n1. High code quality, maintainable\n2. Include necessary comments\n3. Follow existing project code style', 1),
    ('cmd-review', '/review', 'Code review for security and quality', 'Please review the following code changes:\n\n{changes}\n\nReview points:\n1. Security (XSS, SQL injection, command injection, etc.)\n2. Code quality and maintainability\n3. Performance issues\n4. Edge case handling', 1),
    ('cmd-fix-issues', '/fix-issues', 'Fix discovered issues', 'Please fix the following issues:\n\n{issues}\n\nRequirements:\n1. Minimize modification scope\n2. Do not introduce new issues\n3. Add necessary tests', 1),
    ('cmd-test', '/test', 'Write and run tests', 'Please write tests for the following code:\n\n{code}\n\nRequirements:\n1. Cover main functional paths\n2. Include edge cases\n3. Tests should be independently runnable', 1),
    ('cmd-refactor', '/refactor', 'Refactor code', 'Please refactor the following code:\n\n{code}\n\nRefactoring goals:\n{goals}\n\nRequirements:\n1. Keep functionality unchanged\n2. Improve code quality\n3. Step by step, each step verifiable', 1),
    ('cmd-document', '/document', 'Write documentation', 'Please write documentation for the following content:\n\n{content}\n\nDocument type: {doc_type}\n\nRequirements:\n1. Clear and easy to understand\n2. Include examples\n3. Proper format', 1);

-- ----------------------------------------------------------------------------
-- 4. Workflow Table (workflow)
-- Stores workflow configuration and state
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow (
    id                      TEXT PRIMARY KEY,
    project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    description             TEXT,

    -- Status: created, starting, ready, running, paused, merging, completed, failed, cancelled
    status                  TEXT NOT NULL DEFAULT 'created',

    -- Slash command configuration
    use_slash_commands      INTEGER NOT NULL DEFAULT 0,

    -- Main Agent (Orchestrator) configuration
    orchestrator_enabled    INTEGER NOT NULL DEFAULT 1,
    orchestrator_api_type   TEXT,                       -- 'openai' | 'anthropic' | 'custom'
    orchestrator_base_url   TEXT,
    orchestrator_api_key    TEXT,                       -- Encrypted storage
    orchestrator_model      TEXT,

    -- Error handling terminal configuration (optional)
    error_terminal_enabled  INTEGER NOT NULL DEFAULT 0,
    error_terminal_cli_id   TEXT REFERENCES cli_type(id),
    error_terminal_model_id TEXT REFERENCES model_config(id),

    -- Merge terminal configuration (required)
    merge_terminal_cli_id   TEXT NOT NULL REFERENCES cli_type(id),
    merge_terminal_model_id TEXT NOT NULL REFERENCES model_config(id),

    -- Target branch
    target_branch           TEXT NOT NULL DEFAULT 'main',

    -- Timestamps
    ready_at                TEXT,                       -- All terminals started completion time
    started_at              TEXT,                       -- User confirmed start time
    completed_at            TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_project_id ON workflow(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow(status);

-- ----------------------------------------------------------------------------
-- 5. Workflow Command Association Table (workflow_command)
-- Stores slash commands used by workflow and their order
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_command (
    id              TEXT PRIMARY KEY,
    workflow_id     TEXT NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    preset_id       TEXT NOT NULL REFERENCES slash_command_preset(id),
    order_index     INTEGER NOT NULL,                   -- Execution order, starting from 0
    custom_params   TEXT,                               -- JSON format custom parameters
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(workflow_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_workflow_command_workflow_id ON workflow_command(workflow_id);

-- ----------------------------------------------------------------------------
-- 6. Workflow Task Table (workflow_task)
-- Stores parallel tasks in workflow
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_task (
    id              TEXT PRIMARY KEY,
    workflow_id     TEXT NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,

    -- Associated with vibe-kanban task table (optional, for status sync)
    vk_task_id      BLOB REFERENCES tasks(id),

    name            TEXT NOT NULL,
    description     TEXT,
    branch          TEXT NOT NULL,                      -- Git branch name

    -- Status: pending, running, review_pending, completed, failed, cancelled
    status          TEXT NOT NULL DEFAULT 'pending',

    order_index     INTEGER NOT NULL,                   -- Task order (for UI display)

    -- Timestamps
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workflow_task_workflow_id ON workflow_task(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_task_status ON workflow_task(status);

-- ----------------------------------------------------------------------------
-- 7. Terminal Table (terminal)
-- Stores terminal configuration and state for each task
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terminal (
    id                  TEXT PRIMARY KEY,
    workflow_task_id    TEXT NOT NULL REFERENCES workflow_task(id) ON DELETE CASCADE,

    -- CLI and model configuration
    cli_type_id         TEXT NOT NULL REFERENCES cli_type(id),
    model_config_id     TEXT NOT NULL REFERENCES model_config(id),

    -- Custom API configuration (overrides default)
    custom_base_url     TEXT,
    custom_api_key      TEXT,                           -- Encrypted storage

    -- Role description (optional, for main Agent to understand terminal responsibilities)
    role                TEXT,                           -- e.g., 'coder', 'reviewer', 'fixer'
    role_description    TEXT,

    order_index         INTEGER NOT NULL,               -- Execution order within task, starting from 0

    -- Status: not_started, starting, waiting, working, completed, failed, cancelled
    status              TEXT NOT NULL DEFAULT 'not_started',

    -- Process information
    process_id          INTEGER,                        -- OS process ID
    pty_session_id      TEXT,                           -- PTY session ID (for terminal debug view)

    -- Associated with vibe-kanban session (optional)
    vk_session_id       BLOB REFERENCES sessions(id),

    -- Last Git commit information
    last_commit_hash    TEXT,
    last_commit_message TEXT,

    -- Timestamps
    started_at          TEXT,
    completed_at        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_terminal_workflow_task_id ON terminal(workflow_task_id);
CREATE INDEX IF NOT EXISTS idx_terminal_status ON terminal(status);
CREATE INDEX IF NOT EXISTS idx_terminal_cli_type_id ON terminal(cli_type_id);

-- ----------------------------------------------------------------------------
-- 8. Terminal Log Table (terminal_log)
-- Stores terminal execution logs (for debugging and auditing)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS terminal_log (
    id              TEXT PRIMARY KEY,
    terminal_id     TEXT NOT NULL REFERENCES terminal(id) ON DELETE CASCADE,

    -- Log type: stdout, stderr, system, git_event
    log_type        TEXT NOT NULL,

    content         TEXT NOT NULL,

    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_terminal_log_terminal_id ON terminal_log(terminal_id);
CREATE INDEX IF NOT EXISTS idx_terminal_log_created_at ON terminal_log(created_at);

-- ----------------------------------------------------------------------------
-- 9. Git Event Table (git_event)
-- Stores Git commit events (for event-driven)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS git_event (
    id              TEXT PRIMARY KEY,
    workflow_id     TEXT NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    terminal_id     TEXT REFERENCES terminal(id),

    -- Git information
    commit_hash     TEXT NOT NULL,
    branch          TEXT NOT NULL,
    commit_message  TEXT NOT NULL,

    -- Parsed metadata (JSON format)
    metadata        TEXT,

    -- Processing status: pending, processing, processed, failed
    process_status  TEXT NOT NULL DEFAULT 'pending',

    -- Main Agent response (JSON format)
    agent_response  TEXT,

    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_git_event_workflow_id ON git_event(workflow_id);
CREATE INDEX IF NOT EXISTS idx_git_event_terminal_id ON git_event(terminal_id);
CREATE INDEX IF NOT EXISTS idx_git_event_process_status ON git_event(process_status);
SQL_EOF
```

**Step 2: Verify SQL syntax**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
# Check SQL syntax (using sqlite3)
sqlite3 :memory: < "crates/db/migrations/20260117000001_create_workflow_tables.sql"
echo $?  # Should output 0
```

Expected: Command succeeds with exit code 0

**Step 3: Run migration to verify it works**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo sqlx migrate run
```

Expected: Output shows "Applied 20260117000001_create_workflow_tables (xxx ms)"

**Step 4: Verify tables were created**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo sqlx database reset --database-url sqlite:sqlite.db
sqlite3 sqlite.db "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

Expected: Output includes all 9 new tables: cli_type, git_event, model_config, slash_command_preset, terminal, terminal_log, workflow, workflow_command, workflow_task

**Step 5: Verify system data was inserted**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
sqlite3 sqlite.db "SELECT COUNT(*) FROM cli_type;"
```

Expected: Output shows 9 (number of system CLI types)

```bash
sqlite3 sqlite.db "SELECT COUNT(*) FROM slash_command_preset WHERE is_system = 1;"
```

Expected: Output shows 6 (number of system slash commands)

**Step 6: Commit**

```bash
cd "F:\Project\GitCortex\.worktrees\phase-1-database"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\db\migrations\20260117000001_create_workflow_tables.sql"
git commit -m "$(cat <<'EOF'
feat(database): add workflow coordination tables migration

Add 9 new tables for multi-terminal workflow orchestration:
- cli_type: Store AI coding agent CLI information
- model_config: Model configurations for each CLI
- slash_command_preset: Reusable slash command presets
- workflow: Workflow configuration and state
- workflow_command: Slash command associations
- workflow_task: Parallel tasks in workflow
- terminal: Terminal configuration and state
- terminal_log: Terminal execution logs
- git_event: Git commit events for event-driven

Includes system built-in data:
- 9 CLI types (Claude Code, Gemini, Codex, etc.)
- 6 slash command presets
- Default models for each CLI

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.2: Create Rust Models

**Files:**
- Create: `vibe-kanban-main/crates/db/src/models/cli_type.rs`
- Create: `vibe-kanban-main/crates/db/src/models/workflow.rs`
- Create: `vibe-kanban-main/crates/db/src/models/terminal.rs`
- Modify: `vibe-kanban-main/crates/db/src/models/mod.rs`

**Step 1: Create cli_type.rs**

```bash
cat > "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\cli_type.rs" << 'RUST_EOF'
//! CLI Type Model
//!
//! Stores supported AI coding agent CLI information like Claude Code, Gemini CLI, Codex, etc.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool, Type};
use strum_macros::{Display, EnumString};
use ts_rs::TS;

/// CLI Type
///
/// Corresponds to database table: cli_type
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CliType {
    /// Primary key ID, format: cli-{name}
    pub id: String,

    /// Internal name, e.g., 'claude-code'
    pub name: String,

    /// Display name, e.g., 'Claude Code'
    pub display_name: String,

    /// Detection command, e.g., 'claude --version'
    pub detect_command: String,

    /// Installation command (optional)
    pub install_command: Option<String>,

    /// Installation guide URL
    pub install_guide_url: Option<String>,

    /// Config file path template, e.g., '~/.claude/settings.json'
    pub config_file_path: Option<String>,

    /// Is system built-in
    #[serde(default)]
    pub is_system: bool,

    /// Created timestamp
    pub created_at: DateTime<Utc>,
}

/// Model Config
///
/// Corresponds to database table: model_config
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ModelConfig {
    /// Primary key ID, format: model-{cli}-{name}
    pub id: String,

    /// Associated CLI type ID
    pub cli_type_id: String,

    /// Model internal name, e.g., 'sonnet'
    pub name: String,

    /// Display name, e.g., 'Claude Sonnet'
    pub display_name: String,

    /// API model ID, e.g., 'claude-sonnet-4-20250514'
    pub api_model_id: Option<String>,

    /// Is default model
    #[serde(default)]
    pub is_default: bool,

    /// Is official model
    #[serde(default)]
    pub is_official: bool,

    /// Created timestamp
    pub created_at: DateTime<Utc>,

    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
}

/// CLI Detection Status
///
/// For frontend display of CLI installation status
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct CliDetectionStatus {
    /// CLI type ID
    pub cli_type_id: String,

    /// CLI name
    pub name: String,

    /// Display name
    pub display_name: String,

    /// Is installed
    pub installed: bool,

    /// Version number (if installed)
    pub version: Option<String>,

    /// Executable file path (if installed)
    pub executable_path: Option<String>,

    /// Installation guide URL
    pub install_guide_url: Option<String>,
}

impl CliType {
    /// Get all CLI types from database
    pub async fn find_all(pool: &SqlitePool) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, CliType>(
            r#"
            SELECT id, name, display_name, detect_command, install_command,
                   install_guide_url, config_file_path, is_system, created_at
            FROM cli_type
            ORDER BY is_system DESC, name ASC
            "#
        )
        .fetch_all(pool)
        .await
    }

    /// Find CLI type by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> sqlx::Result<Option<Self>> {
        sqlx::query_as::<_, CliType>(
            r#"
            SELECT id, name, display_name, detect_command, install_command,
                   install_guide_url, config_file_path, is_system, created_at
            FROM cli_type
            WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Find CLI type by name
    pub async fn find_by_name(pool: &SqlitePool, name: &str) -> sqlx::Result<Option<Self>> {
        sqlx::query_as::<_, CliType>(
            r#"
            SELECT id, name, display_name, detect_command, install_command,
                   install_guide_url, config_file_path, is_system, created_at
            FROM cli_type
            WHERE name = ?
            "#
        )
        .bind(name)
        .fetch_optional(pool)
        .await
    }
}

impl ModelConfig {
    /// Get all models for a CLI type
    pub async fn find_by_cli_type(pool: &SqlitePool, cli_type_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, ModelConfig>(
            r#"
            SELECT id, cli_type_id, name, display_name, api_model_id,
                   is_default, is_official, created_at, updated_at
            FROM model_config
            WHERE cli_type_id = ?
            ORDER BY is_default DESC, name ASC
            "#
        )
        .bind(cli_type_id)
        .fetch_all(pool)
        .await
    }

    /// Find model config by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> sqlx::Result<Option<Self>> {
        sqlx::query_as::<_, ModelConfig>(
            r#"
            SELECT id, cli_type_id, name, display_name, api_model_id,
                   is_default, is_official, created_at, updated_at
            FROM model_config
            WHERE id = ?
            "#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Get default model for a CLI type
    pub async fn find_default_for_cli(pool: &SqlitePool, cli_type_id: &str) -> sqlx::Result<Option<Self>> {
        sqlx::query_as::<_, ModelConfig>(
            r#"
            SELECT id, cli_type_id, name, display_name, api_model_id,
                   is_default, is_official, created_at, updated_at
            FROM model_config
            WHERE cli_type_id = ? AND is_default = 1
            LIMIT 1
            "#
        )
        .bind(cli_type_id)
        .fetch_optional(pool)
        .await
    }
}
RUST_EOF
```

**Step 2: Verify cli_type.rs compiles**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build -p db 2>&1 | grep -E "(error|warning|Compiling|Finished)"
```

Expected: "Compiling db v..." followed by "Finished" (no errors)

**Step 3: Create workflow.rs**

```bash
cat > "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\workflow.rs" << 'RUST_EOF'
//! Workflow Model
//!
//! Stores workflow configuration and state for multi-terminal orchestration.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool, Type};
use strum_macros::{Display, EnumString};
use ts_rs::TS;
use uuid::Uuid;

/// Workflow Status Enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, TS, EnumString, Display)]
#[sqlx(type_name = "workflow_status", rename_all = "lowercase")]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "lowercase")]
pub enum WorkflowStatus {
    /// Created, waiting for configuration
    Created,
    /// Starting terminals
    Starting,
    /// All terminals ready, waiting for user to confirm start
    Ready,
    /// Running
    Running,
    /// Paused
    Paused,
    /// Merging branches
    Merging,
    /// Completed
    Completed,
    /// Failed
    Failed,
    /// Cancelled
    Cancelled,
}

impl Default for WorkflowStatus {
    fn default() -> Self {
        Self::Created
    }
}

/// Workflow Task Status Enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, TS, EnumString, Display)]
#[sqlx(type_name = "workflow_task_status", rename_all = "lowercase")]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "lowercase")]
pub enum WorkflowTaskStatus {
    /// Waiting to execute
    Pending,
    /// Running
    Running,
    /// Waiting for review
    ReviewPending,
    /// Completed
    Completed,
    /// Failed
    Failed,
    /// Cancelled
    Cancelled,
}

impl Default for WorkflowTaskStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// Workflow
///
/// Corresponds to database table: workflow
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Workflow {
    /// Primary key ID (UUID as String for compatibility)
    pub id: String,

    /// Associated project ID
    pub project_id: String,

    /// Workflow name
    pub name: String,

    /// Workflow description
    pub description: Option<String>,

    /// Status
    pub status: String,

    /// Use slash commands
    #[serde(default)]
    pub use_slash_commands: bool,

    /// Enable main Agent
    #[serde(default)]
    pub orchestrator_enabled: bool,

    /// Main Agent API type: 'openai' | 'anthropic' | 'custom'
    pub orchestrator_api_type: Option<String>,

    /// Main Agent API Base URL
    pub orchestrator_base_url: Option<String>,

    /// Main Agent API Key (encrypted storage)
    pub orchestrator_api_key: Option<String>,

    /// Main Agent model
    pub orchestrator_model: Option<String>,

    /// Enable error handling terminal
    #[serde(default)]
    pub error_terminal_enabled: bool,

    /// Error handling terminal CLI ID
    pub error_terminal_cli_id: Option<String>,

    /// Error handling terminal model ID
    pub error_terminal_model_id: Option<String>,

    /// Merge terminal CLI ID
    pub merge_terminal_cli_id: String,

    /// Merge terminal model ID
    pub merge_terminal_model_id: String,

    /// Target branch
    pub target_branch: String,

    /// All terminals ready timestamp
    pub ready_at: Option<DateTime<Utc>>,

    /// User confirmed start timestamp
    pub started_at: Option<DateTime<Utc>>,

    /// Completed timestamp
    pub completed_at: Option<DateTime<Utc>>,

    /// Created timestamp
    pub created_at: DateTime<Utc>,

    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
}

/// Workflow Task
///
/// Corresponds to database table: workflow_task
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorkflowTask {
    /// Primary key ID (UUID as String)
    pub id: String,

    /// Associated workflow ID
    pub workflow_id: String,

    /// Associated vibe-kanban task ID (optional)
    pub vk_task_id: Option<Uuid>,

    /// Task name
    pub name: String,

    /// Task description
    pub description: Option<String>,

    /// Git branch name
    pub branch: String,

    /// Status
    pub status: String,

    /// Task order
    pub order_index: i32,

    /// Started timestamp
    pub started_at: Option<DateTime<Utc>>,

    /// Completed timestamp
    pub completed_at: Option<DateTime<Utc>>,

    /// Created timestamp
    pub created_at: DateTime<Utc>,

    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
}

/// Slash Command Preset
///
/// Corresponds to database table: slash_command_preset
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct SlashCommandPreset {
    /// Primary key ID
    pub id: String,

    /// Command name, e.g., '/write-code'
    pub command: String,

    /// Command description
    pub description: String,

    /// Prompt template
    pub prompt_template: Option<String>,

    /// Is system built-in
    #[serde(default)]
    pub is_system: bool,

    /// Created timestamp
    pub created_at: DateTime<Utc>,

    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
}

/// Workflow Command Association
///
/// Corresponds to database table: workflow_command
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct WorkflowCommand {
    /// Primary key ID
    pub id: String,

    /// Associated workflow ID
    pub workflow_id: String,

    /// Associated preset ID
    pub preset_id: String,

    /// Execution order
    pub order_index: i32,

    /// Custom parameters (JSON format)
    pub custom_params: Option<String>,

    /// Created timestamp
    pub created_at: DateTime<Utc>,
}

/// Create Workflow Request
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct CreateWorkflowRequest {
    /// Project ID
    pub project_id: String,
    /// Workflow name
    pub name: String,
    /// Workflow description
    pub description: Option<String>,
    /// Use slash commands
    pub use_slash_commands: bool,
    /// Slash command ID list (in order)
    pub command_preset_ids: Option<Vec<String>>,
    /// Main Agent configuration
    pub orchestrator_config: Option<OrchestratorConfig>,
    /// Error handling terminal configuration
    pub error_terminal_config: Option<TerminalConfig>,
    /// Merge terminal configuration
    pub merge_terminal_config: TerminalConfig,
    /// Target branch
    pub target_branch: Option<String>,
}

/// Main Agent Configuration
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct OrchestratorConfig {
    pub api_type: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

/// Terminal Configuration
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct TerminalConfig {
    pub cli_type_id: String,
    pub model_config_id: String,
    pub custom_base_url: Option<String>,
    pub custom_api_key: Option<String>,
}

impl Workflow {
    /// Create workflow
    pub async fn create(pool: &SqlitePool, workflow: &Workflow) -> sqlx::Result<Self> {
        sqlx::query_as::<_, Workflow>(
            r#"
            INSERT INTO workflow (
                id, project_id, name, description, status,
                use_slash_commands, orchestrator_enabled,
                orchestrator_api_type, orchestrator_base_url,
                orchestrator_api_key, orchestrator_model,
                error_terminal_enabled, error_terminal_cli_id, error_terminal_model_id,
                merge_terminal_cli_id, merge_terminal_model_id,
                target_branch, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
            RETURNING *
            "#
        )
        .bind(&workflow.id)
        .bind(&workflow.project_id)
        .bind(&workflow.name)
        .bind(&workflow.description)
        .bind(&workflow.status)
        .bind(workflow.use_slash_commands)
        .bind(workflow.orchestrator_enabled)
        .bind(&workflow.orchestrator_api_type)
        .bind(&workflow.orchestrator_base_url)
        .bind(&workflow.orchestrator_api_key)
        .bind(&workflow.orchestrator_model)
        .bind(workflow.error_terminal_enabled)
        .bind(&workflow.error_terminal_cli_id)
        .bind(&workflow.error_terminal_model_id)
        .bind(&workflow.merge_terminal_cli_id)
        .bind(&workflow.merge_terminal_model_id)
        .bind(&workflow.target_branch)
        .bind(workflow.created_at)
        .bind(workflow.updated_at)
        .fetch_one(pool)
        .await
    }

    /// Find workflow by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> sqlx::Result<Option<Self>> {
        sqlx::query_as::<_, Workflow>(
            r#"SELECT * FROM workflow WHERE id = ?"#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Find workflows by project
    pub async fn find_by_project(pool: &SqlitePool, project_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, Workflow>(
            r#"
            SELECT * FROM workflow
            WHERE project_id = ?
            ORDER BY created_at DESC
            "#
        )
        .bind(project_id)
        .fetch_all(pool)
        .await
    }

    /// Update workflow status
    pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE workflow
            SET status = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Set workflow to ready
    pub async fn set_ready(pool: &SqlitePool, id: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE workflow
            SET status = 'ready', ready_at = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Set workflow started
    pub async fn set_started(pool: &SqlitePool, id: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE workflow
            SET status = 'running', started_at = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Delete workflow
    pub async fn delete(pool: &SqlitePool, id: &str) -> sqlx::Result<u64> {
        let result = sqlx::query("DELETE FROM workflow WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }
}

impl WorkflowTask {
    /// Create workflow task
    pub async fn create(pool: &SqlitePool, task: &WorkflowTask) -> sqlx::Result<Self> {
        sqlx::query_as::<_, WorkflowTask>(
            r#"
            INSERT INTO workflow_task (
                id, workflow_id, vk_task_id, name, description,
                branch, status, order_index, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            RETURNING *
            "#
        )
        .bind(&task.id)
        .bind(&task.workflow_id)
        .bind(task.vk_task_id)
        .bind(&task.name)
        .bind(&task.description)
        .bind(&task.branch)
        .bind(&task.status)
        .bind(task.order_index)
        .bind(task.created_at)
        .bind(task.updated_at)
        .fetch_one(pool)
        .await
    }

    /// Find tasks by workflow
    pub async fn find_by_workflow(pool: &SqlitePool, workflow_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, WorkflowTask>(
            r#"
            SELECT * FROM workflow_task
            WHERE workflow_id = ?
            ORDER BY order_index ASC
            "#
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
    }

    /// Find workflow task by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> sqlx::Result<Option<Self>> {
        sqlx::query_as::<_, WorkflowTask>(
            r#"SELECT * FROM workflow_task WHERE id = ?"#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Update workflow task status
    pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE workflow_task
            SET status = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }
}

impl SlashCommandPreset {
    /// Get all slash command presets
    pub async fn find_all(pool: &SqlitePool) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, SlashCommandPreset>(
            r#"
            SELECT * FROM slash_command_preset
            ORDER BY is_system DESC, command ASC
            "#
        )
        .fetch_all(pool)
        .await
    }
}

impl WorkflowCommand {
    /// Get commands by workflow
    pub async fn find_by_workflow(pool: &SqlitePool, workflow_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, WorkflowCommand>(
            r#"
            SELECT * FROM workflow_command
            WHERE workflow_id = ?
            ORDER BY order_index ASC
            "#
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
    }

    /// Add command to workflow
    pub async fn create(
        pool: &SqlitePool,
        workflow_id: &str,
        preset_id: &str,
        order_index: i32,
        custom_params: Option<&str>,
    ) -> sqlx::Result<Self> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        sqlx::query_as::<_, WorkflowCommand>(
            r#"
            INSERT INTO workflow_command (id, workflow_id, preset_id, order_index, custom_params, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            RETURNING *
            "#
        )
        .bind(&id)
        .bind(workflow_id)
        .bind(preset_id)
        .bind(order_index)
        .bind(custom_params)
        .bind(now)
        .fetch_one(pool)
        .await
    }
}
RUST_EOF
```

**Step 4: Verify workflow.rs compiles**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build -p db 2>&1 | grep -E "(error|warning|Compiling|Finished)"
```

Expected: "Compiling db v..." followed by "Finished" (no errors)

**Step 5: Create terminal.rs**

```bash
cat > "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\terminal.rs" << 'RUST_EOF'
//! Terminal Model
//!
//! Stores terminal configuration and state for each task.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool, Type};
use strum_macros::{Display, EnumString};
use ts_rs::TS;
use uuid::Uuid;

/// Terminal Status Enum
#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, TS, EnumString, Display)]
#[sqlx(type_name = "terminal_status", rename_all = "lowercase")]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "lowercase")]
pub enum TerminalStatus {
    /// Not started
    NotStarted,
    /// Starting
    Starting,
    /// Waiting (started, waiting for instructions)
    Waiting,
    /// Working
    Working,
    /// Completed
    Completed,
    /// Failed
    Failed,
    /// Cancelled
    Cancelled,
}

impl Default for TerminalStatus {
    fn default() -> Self {
        Self::NotStarted
    }
}

/// Terminal
///
/// Corresponds to database table: terminal
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Terminal {
    /// Primary key ID (UUID as String)
    pub id: String,

    /// Associated workflow task ID
    pub workflow_task_id: String,

    /// CLI type ID
    pub cli_type_id: String,

    /// Model config ID
    pub model_config_id: String,

    /// Custom API Base URL
    pub custom_base_url: Option<String>,

    /// Custom API Key (encrypted storage)
    pub custom_api_key: Option<String>,

    /// Role, e.g., 'coder', 'reviewer', 'fixer'
    pub role: Option<String>,

    /// Role description
    pub role_description: Option<String>,

    /// Execution order within task
    pub order_index: i32,

    /// Status
    pub status: String,

    /// OS process ID
    pub process_id: Option<i32>,

    /// PTY session ID
    pub pty_session_id: Option<String>,

    /// Associated vibe-kanban session ID
    pub vk_session_id: Option<Uuid>,

    /// Last Git commit hash
    pub last_commit_hash: Option<String>,

    /// Last Git commit message
    pub last_commit_message: Option<String>,

    /// Started timestamp
    pub started_at: Option<DateTime<Utc>>,

    /// Completed timestamp
    pub completed_at: Option<DateTime<Utc>>,

    /// Created timestamp
    pub created_at: DateTime<Utc>,

    /// Updated timestamp
    pub updated_at: DateTime<Utc>,
}

/// Terminal Log Type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, TS, EnumString, Display)]
#[sqlx(type_name = "terminal_log_type", rename_all = "lowercase")]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "lowercase")]
pub enum TerminalLogType {
    Stdout,
    Stderr,
    System,
    GitEvent,
}

/// Terminal Log
///
/// Corresponds to database table: terminal_log
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TerminalLog {
    /// Primary key ID
    pub id: String,

    /// Associated terminal ID
    pub terminal_id: String,

    /// Log type
    pub log_type: String,

    /// Log content
    pub content: String,

    /// Created timestamp
    pub created_at: DateTime<Utc>,
}

/// Git Event
///
/// Corresponds to database table: git_event
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct GitEvent {
    /// Primary key ID
    pub id: String,

    /// Associated workflow ID
    pub workflow_id: String,

    /// Associated terminal ID (optional)
    pub terminal_id: Option<String>,

    /// Git commit hash
    pub commit_hash: String,

    /// Git branch
    pub branch: String,

    /// Commit message
    pub commit_message: String,

    /// Parsed metadata (JSON format)
    pub metadata: Option<String>,

    /// Processing status
    pub process_status: String,

    /// Main Agent response (JSON format)
    pub agent_response: Option<String>,

    /// Created timestamp
    pub created_at: DateTime<Utc>,

    /// Processed timestamp
    pub processed_at: Option<DateTime<Utc>>,
}

/// Terminal Detail (includes associated CLI and model info)
///
/// For API response with complete terminal information
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TerminalDetail {
    /// Terminal basic info
    #[serde(flatten)]
    #[ts(flatten)]
    pub terminal: Terminal,

    /// CLI type info
    pub cli_type: super::cli_type::CliType,

    /// Model config info
    pub model_config: super::cli_type::ModelConfig,
}

/// Create Terminal Request
#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct CreateTerminalRequest {
    pub cli_type_id: String,
    pub model_config_id: String,
    pub custom_base_url: Option<String>,
    pub custom_api_key: Option<String>,
    pub role: Option<String>,
    pub role_description: Option<String>,
}

impl Terminal {
    /// Create terminal
    pub async fn create(pool: &SqlitePool, terminal: &Terminal) -> sqlx::Result<Self> {
        sqlx::query_as::<_, Terminal>(
            r#"
            INSERT INTO terminal (
                id, workflow_task_id, cli_type_id, model_config_id,
                custom_base_url, custom_api_key, role, role_description,
                order_index, status, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            RETURNING *
            "#
        )
        .bind(&terminal.id)
        .bind(&terminal.workflow_task_id)
        .bind(&terminal.cli_type_id)
        .bind(&terminal.model_config_id)
        .bind(&terminal.custom_base_url)
        .bind(&terminal.custom_api_key)
        .bind(&terminal.role)
        .bind(&terminal.role_description)
        .bind(terminal.order_index)
        .bind(&terminal.status)
        .bind(terminal.created_at)
        .bind(terminal.updated_at)
        .fetch_one(pool)
        .await
    }

    /// Find terminal by ID
    pub async fn find_by_id(pool: &SqlitePool, id: &str) -> sqlx::Result<Option<Self>> {
        sqlx::query_as::<_, Terminal>(
            r#"SELECT * FROM terminal WHERE id = ?"#
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Find terminals by task
    pub async fn find_by_task(pool: &SqlitePool, workflow_task_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, Terminal>(
            r#"
            SELECT * FROM terminal
            WHERE workflow_task_id = ?
            ORDER BY order_index ASC
            "#
        )
        .bind(workflow_task_id)
        .fetch_all(pool)
        .await
    }

    /// Find terminals by workflow (across tasks)
    pub async fn find_by_workflow(pool: &SqlitePool, workflow_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, Terminal>(
            r#"
            SELECT t.* FROM terminal t
            INNER JOIN workflow_task wt ON t.workflow_task_id = wt.id
            WHERE wt.workflow_id = ?
            ORDER BY wt.order_index ASC, t.order_index ASC
            "#
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
    }

    /// Update terminal status
    pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE terminal
            SET status = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(status)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Update terminal process info
    pub async fn update_process(
        pool: &SqlitePool,
        id: &str,
        process_id: Option<i32>,
        pty_session_id: Option<&str>,
    ) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE terminal
            SET process_id = ?, pty_session_id = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(process_id)
        .bind(pty_session_id)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Update terminal last commit info
    pub async fn update_last_commit(
        pool: &SqlitePool,
        id: &str,
        commit_hash: &str,
        commit_message: &str,
    ) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE terminal
            SET last_commit_hash = ?, last_commit_message = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(commit_hash)
        .bind(commit_message)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Set terminal started
    pub async fn set_started(pool: &SqlitePool, id: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE terminal
            SET status = 'waiting', started_at = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Set terminal completed
    pub async fn set_completed(pool: &SqlitePool, id: &str, status: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE terminal
            SET status = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(status)
        .bind(now)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }
}

impl TerminalLog {
    /// Add terminal log
    pub async fn create(
        pool: &SqlitePool,
        terminal_id: &str,
        log_type: &str,
        content: &str,
    ) -> sqlx::Result<Self> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        sqlx::query_as::<_, TerminalLog>(
            r#"
            INSERT INTO terminal_log (id, terminal_id, log_type, content, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            RETURNING *
            "#
        )
        .bind(&id)
        .bind(terminal_id)
        .bind(log_type)
        .bind(content)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    /// Find logs by terminal
    pub async fn find_by_terminal(
        pool: &SqlitePool,
        terminal_id: &str,
        limit: Option<i32>,
    ) -> sqlx::Result<Vec<Self>> {
        let limit = limit.unwrap_or(1000);
        sqlx::query_as::<_, TerminalLog>(
            r#"
            SELECT * FROM terminal_log
            WHERE terminal_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#
        )
        .bind(terminal_id)
        .bind(limit)
        .fetch_all(pool)
        .await
    }
}

impl GitEvent {
    /// Create git event
    pub async fn create(
        pool: &SqlitePool,
        workflow_id: &str,
        terminal_id: Option<&str>,
        commit_hash: &str,
        branch: &str,
        commit_message: &str,
        metadata: Option<&str>,
    ) -> sqlx::Result<Self> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        sqlx::query_as::<_, GitEvent>(
            r#"
            INSERT INTO git_event (
                id, workflow_id, terminal_id, commit_hash, branch,
                commit_message, metadata, process_status, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8)
            RETURNING *
            "#
        )
        .bind(&id)
        .bind(workflow_id)
        .bind(terminal_id)
        .bind(commit_hash)
        .bind(branch)
        .bind(commit_message)
        .bind(metadata)
        .bind(now)
        .fetch_one(pool)
        .await
    }

    /// Find pending git events
    pub async fn find_pending(pool: &SqlitePool, workflow_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, GitEvent>(
            r#"
            SELECT * FROM git_event
            WHERE workflow_id = ? AND process_status = 'pending'
            ORDER BY created_at ASC
            "#
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
    }

    /// Update git event processing status
    pub async fn update_status(
        pool: &SqlitePool,
        id: &str,
        status: &str,
        agent_response: Option<&str>,
    ) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE git_event
            SET process_status = ?, agent_response = ?, processed_at = ?
            WHERE id = ?
            "#
        )
        .bind(status)
        .bind(agent_response)
        .bind(now)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }
}
RUST_EOF
```

**Step 6: Verify terminal.rs compiles**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build -p db 2>&1 | grep -E "(error|warning|Compiling|Finished)"
```

Expected: "Compiling db v..." followed by "Finished" (no errors)

**Step 7: Update mod.rs to export new models**

```bash
cat >> "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\mod.rs" << 'RUST_EOF'

// GitCortex Workflow models
pub mod cli_type;
pub mod workflow;
pub mod terminal;

pub use cli_type::*;
pub use workflow::*;
pub use terminal::*;
RUST_EOF
```

**Step 8: Verify all models compile together**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build -p db 2>&1 | grep -E "(error|warning|Compiling|Finished)"
```

Expected: "Compiling db v..." followed by "Finished" (no errors)

**Step 9: Generate TypeScript types**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo run --bin generate_types 2>&1 | tail -20
```

Expected: TypeScript types generated successfully in `shared/types.ts`

**Step 10: Verify TypeScript types were generated**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
grep -E "(CliType|ModelConfig|Workflow|Terminal)" shared/types.ts | head -20
```

Expected: Output shows type definitions like `export interface CliType`, `export interface Workflow`, etc.

**Step 11: Commit**

```bash
cd "F:\Project\GitCortex\.worktrees\phase-1-database"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\cli_type.rs"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\workflow.rs"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\terminal.rs"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\db\src\models\mod.rs"
git commit -m "$(cat <<'EOF'
feat(models): add workflow Rust models with TypeScript export

Add three new model files for workflow coordination:
- cli_type.rs: CliType, ModelConfig, CliDetectionStatus
- workflow.rs: Workflow, WorkflowTask, SlashCommandPreset, WorkflowCommand
- terminal.rs: Terminal, TerminalLog, GitEvent, TerminalDetail

All models include:
- Database CRUD methods using sqlx
- TypeScript export via ts_rs
- Serde serialization support

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.3: Create API Routes

**Files:**
- Create: `vibe-kanban-main/crates/server/src/routes/cli_types.rs`
- Create: `vibe-kanban-main/crates/server/src/routes/workflows.rs`
- Modify: `vibe-kanban-main/crates/server/src/routes/mod.rs`

**Step 1: Check existing server route patterns**

```bash
cat "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\tasks.rs" | head -100
```

**Step 2: Create cli_types.rs route**

```bash
cat > "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\cli_types.rs" << 'RUST_EOF'
//! CLI Type API Routes

use axum::{
    extract::{Path, State},
    routing::get,
    Json, Router,
};
use db::models::{CliType, ModelConfig, CliDetectionStatus, CliType as CliTypeModel};
use std::sync::Arc;
use crate::{error::ApiError, AppState};

/// Create CLI types router
pub fn cli_types_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_cli_types))
        .route("/detect", get(detect_cli_types))
        .route("/:cli_type_id/models", get(list_models_for_cli))
}

/// GET /api/cli_types
/// List all CLI types
async fn list_cli_types(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CliType>>, ApiError> {
    let cli_types = CliTypeModel::find_all(&state.db.pool).await?;
    Ok(Json(cli_types))
}

/// GET /api/cli_types/detect
/// Detect installed CLIs
async fn detect_cli_types(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CliDetectionStatus>>, ApiError> {
    let cli_types = CliTypeModel::find_all(&state.db.pool).await?;
    let mut results = Vec::new();

    for cli_type in cli_types {
        let status = detect_single_cli(&cli_type).await;
        results.push(status);
    }

    Ok(Json(results))
}

/// Detect single CLI
async fn detect_single_cli(cli_type: &CliType) -> CliDetectionStatus {
    use tokio::process::Command;

    // Parse detect command
    let parts: Vec<&str> = cli_type.detect_command.split_whitespace().collect();
    if parts.is_empty() {
        return CliDetectionStatus {
            cli_type_id: cli_type.id.clone(),
            name: cli_type.name.clone(),
            display_name: cli_type.display_name.clone(),
            installed: false,
            version: None,
            executable_path: None,
            install_guide_url: cli_type.install_guide_url.clone(),
        };
    }

    let cmd = parts[0];
    let args = &parts[1..];

    // Execute detect command
    let result = Command::new(cmd)
        .args(args)
        .output()
        .await;

    match result {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .map(|s| s.trim().to_string());

            // Try to get executable path
            let executable_path = which::which(cmd)
                .ok()
                .map(|p| p.to_string_lossy().to_string());

            CliDetectionStatus {
                cli_type_id: cli_type.id.clone(),
                name: cli_type.name.clone(),
                display_name: cli_type.display_name.clone(),
                installed: true,
                version,
                executable_path,
                install_guide_url: cli_type.install_guide_url.clone(),
            }
        }
        _ => CliDetectionStatus {
            cli_type_id: cli_type.id.clone(),
            name: cli_type.name.clone(),
            display_name: cli_type.display_name.clone(),
            installed: false,
            version: None,
            executable_path: None,
            install_guide_url: cli_type.install_guide_url.clone(),
        },
    }
}

/// GET /api/cli_types/:cli_type_id/models
/// List models for a CLI type
async fn list_models_for_cli(
    State(state): State<Arc<AppState>>,
    Path(cli_type_id): Path<String>,
) -> Result<Json<Vec<ModelConfig>>, ApiError> {
    let models = ModelConfig::find_by_cli_type(&state.db.pool, &cli_type_id).await?;
    Ok(Json(models))
}
RUST_EOF
```

**Step 3: Verify cli_types.rs compiles**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build -p server 2>&1 | grep -E "(error|warning|Compiling|Finished)"
```

Expected: "Compiling server v..." followed by "Finished" (no errors)

**Step 4: Create workflows.rs route (part 1: types)**

```bash
cat > "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\workflows.rs" << 'RUST_EOF'
//! Workflow API Routes

use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put, delete},
    Json, Router,
};
use db::models::{
    Workflow, WorkflowTask, Terminal, SlashCommandPreset, WorkflowCommand,
    CreateWorkflowRequest, TerminalConfig, OrchestratorConfig,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use crate::{error::ApiError, AppState};

// ============================================================================
// Request/Response Types
// ============================================================================

/// Create Workflow Task Request
#[derive(Debug, Deserialize)]
pub struct CreateWorkflowTaskRequest {
    /// Task name
    pub name: String,
    /// Task description
    pub description: Option<String>,
    /// Git branch name (optional, auto-generated)
    pub branch: Option<String>,
    /// Terminals list
    pub terminals: Vec<CreateTerminalRequest>,
}

/// Create Terminal Request
#[derive(Debug, Deserialize)]
pub struct CreateTerminalRequest {
    pub cli_type_id: String,
    pub model_config_id: String,
    pub custom_base_url: Option<String>,
    pub custom_api_key: Option<String>,
    pub role: Option<String>,
    pub role_description: Option<String>,
}

/// Workflow Detail Response
#[derive(Debug, Serialize)]
pub struct WorkflowDetailResponse {
    #[serde(flatten)]
    pub workflow: Workflow,
    pub tasks: Vec<WorkflowTaskDetailResponse>,
    pub commands: Vec<WorkflowCommandWithPreset>,
}

/// Workflow Task Detail Response
#[derive(Debug, Serialize)]
pub struct WorkflowTaskDetailResponse {
    #[serde(flatten)]
    pub task: WorkflowTask,
    pub terminals: Vec<Terminal>,
}

/// Workflow Command with Preset
#[derive(Debug, Serialize)]
pub struct WorkflowCommandWithPreset {
    #[serde(flatten)]
    pub command: WorkflowCommand,
    pub preset: SlashCommandPreset,
}

/// Update Workflow Status Request
#[derive(Debug, Deserialize)]
pub struct UpdateWorkflowStatusRequest {
    pub status: String,
}

// ============================================================================
// Route Definition
// ============================================================================

/// Create workflows router
pub fn workflows_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_workflows).post(create_workflow))
        .route("/:workflow_id", get(get_workflow).delete(delete_workflow))
        .route("/:workflow_id/status", put(update_workflow_status))
        .route("/:workflow_id/start", post(start_workflow))
        .route("/:workflow_id/tasks", get(list_workflow_tasks))
        .route("/:workflow_id/tasks/:task_id/terminals", get(list_task_terminals))
        .route("/presets/commands", get(list_command_presets))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workflows?project_id=xxx
/// List workflows for a project
async fn list_workflows(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<Workflow>>, ApiError> {
    let project_id = params
        .get("project_id")
        .ok_or_else(|| ApiError::BadRequest("project_id is required".to_string()))?;

    let workflows = Workflow::find_by_project(&state.db.pool, project_id).await?;
    Ok(Json(workflows))
}

/// POST /api/workflows
/// Create workflow
async fn create_workflow(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateWorkflowRequest>,
) -> Result<Json<WorkflowDetailResponse>, ApiError> {
    let now = chrono::Utc::now();
    let workflow_id = Uuid::new_v4().to_string();

    // 1. Create workflow
    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: req.project_id,
        name: req.name,
        description: req.description,
        status: "created".to_string(),
        use_slash_commands: req.use_slash_commands,
        orchestrator_enabled: req.orchestrator_config.is_some(),
        orchestrator_api_type: req.orchestrator_config.as_ref().map(|c| c.api_type.clone()),
        orchestrator_base_url: req.orchestrator_config.as_ref().map(|c| c.base_url.clone()),
        orchestrator_api_key: req.orchestrator_config.as_ref().map(|c| c.api_key.clone()),
        orchestrator_model: req.orchestrator_config.as_ref().map(|c| c.model.clone()),
        error_terminal_enabled: req.error_terminal_config.is_some(),
        error_terminal_cli_id: req.error_terminal_config.as_ref().map(|c| c.cli_type_id.clone()),
        error_terminal_model_id: req.error_terminal_config.as_ref().map(|c| c.model_config_id.clone()),
        merge_terminal_cli_id: req.merge_terminal_config.cli_type_id.clone(),
        merge_terminal_model_id: req.merge_terminal_config.model_config_id.clone(),
        target_branch: req.target_branch.unwrap_or_else(|| "main".to_string()),
        ready_at: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    let workflow = Workflow::create(&state.db.pool, &workflow).await?;

    // 2. Create slash command associations
    let mut commands = Vec::new();
    if let Some(preset_ids) = req.command_preset_ids {
        for (index, preset_id) in preset_ids.iter().enumerate() {
            WorkflowCommand::create(
                &state.db.pool,
                &workflow_id,
                preset_id,
                index as i32,
                None,
            ).await?;
        }
        commands = WorkflowCommand::find_by_workflow(&state.db.pool, &workflow_id).await?;
    }

    // 3. Create tasks and terminals (simplified for now)
    let task_details = Vec::new();

    // 4. Get command preset details
    let all_presets = SlashCommandPreset::find_all(&state.db.pool).await?;
    let commands_with_presets: Vec<WorkflowCommandWithPreset> = commands
        .into_iter()
        .filter_map(|cmd| {
            all_presets.iter()
                .find(|p| p.id == cmd.preset_id)
                .map(|preset| WorkflowCommandWithPreset {
                    command: cmd,
                    preset: preset.clone(),
                })
        })
        .collect();

    Ok(Json(WorkflowDetailResponse {
        workflow,
        tasks: task_details,
        commands: commands_with_presets,
    }))
}

/// GET /api/workflows/:workflow_id
/// Get workflow details
async fn get_workflow(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
) -> Result<Json<WorkflowDetailResponse>, ApiError> {
    // Get workflow
    let workflow = Workflow::find_by_id(&state.db.pool, &workflow_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Workflow not found".to_string()))?;

    // Get tasks and terminals
    let tasks = WorkflowTask::find_by_workflow(&state.db.pool, &workflow_id).await?;
    let mut task_details = Vec::new();
    for task in tasks {
        let terminals = Terminal::find_by_task(&state.db.pool, &task.id).await?;
        task_details.push(WorkflowTaskDetailResponse {
            task,
            terminals,
        });
    }

    // Get commands
    let commands = WorkflowCommand::find_by_workflow(&state.db.pool, &workflow_id).await?;
    let all_presets = SlashCommandPreset::find_all(&state.db.pool).await?;
    let commands_with_presets: Vec<WorkflowCommandWithPreset> = commands
        .into_iter()
        .filter_map(|cmd| {
            all_presets.iter()
                .find(|p| p.id == cmd.preset_id)
                .map(|preset| WorkflowCommandWithPreset {
                    command: cmd,
                    preset: preset.clone(),
                })
        })
        .collect();

    Ok(Json(WorkflowDetailResponse {
        workflow,
        tasks: task_details,
        commands: commands_with_presets,
    }))
}

/// DELETE /api/workflows/:workflow_id
/// Delete workflow
async fn delete_workflow(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
) -> Result<Json<()>, ApiError> {
    Workflow::delete(&state.db.pool, &workflow_id).await?;
    Ok(Json(()))
}

/// PUT /api/workflows/:workflow_id/status
/// Update workflow status
async fn update_workflow_status(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
    Json(req): Json<UpdateWorkflowStatusRequest>,
) -> Result<Json<()>, ApiError> {
    Workflow::update_status(&state.db.pool, &workflow_id, &req.status).await?;
    Ok(Json(()))
}

/// POST /api/workflows/:workflow_id/start
/// Start workflow (user confirmed)
async fn start_workflow(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
) -> Result<Json<()>, ApiError> {
    // Check workflow status is ready
    let workflow = Workflow::find_by_id(&state.db.pool, &workflow_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Workflow not found".to_string()))?;

    if workflow.status != "ready" {
        return Err(ApiError::BadRequest(
            format!("Workflow is not ready. Current status: {}", workflow.status)
        ));
    }

    // Update status to running
    Workflow::set_started(&state.db.pool, &workflow_id).await?;

    // TODO: Trigger Orchestrator to start coordination

    Ok(Json(()))
}

/// GET /api/workflows/:workflow_id/tasks
/// List workflow tasks
async fn list_workflow_tasks(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
) -> Result<Json<Vec<WorkflowTaskDetailResponse>>, ApiError> {
    let tasks = WorkflowTask::find_by_workflow(&state.db.pool, &workflow_id).await?;
    let mut task_details = Vec::new();
    for task in tasks {
        let terminals = Terminal::find_by_task(&state.db.pool, &task.id).await?;
        task_details.push(WorkflowTaskDetailResponse {
            task,
            terminals,
        });
    }
    Ok(Json(task_details))
}

/// GET /api/workflows/:workflow_id/tasks/:task_id/terminals
/// List task terminals
async fn list_task_terminals(
    State(state): State<Arc<AppState>>,
    Path((_, task_id)): Path<(String, String)>,
) -> Result<Json<Vec<Terminal>>, ApiError> {
    let terminals = Terminal::find_by_task(&state.db.pool, &task_id).await?;
    Ok(Json(terminals))
}

/// GET /api/workflows/presets/commands
/// List slash command presets
async fn list_command_presets(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<SlashCommandPreset>>, ApiError> {
    let presets = SlashCommandPreset::find_all(&state.db.pool).await?;
    Ok(Json(presets))
}
RUST_EOF
```

**Step 5: Verify workflows.rs compiles**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build -p server 2>&1 | grep -E "(error|warning|Compiling|Finished)"
```

Expected: "Compiling server v..." followed by "Finished" (no errors)

**Step 6: Update routes/mod.rs to register new routes**

```bash
# Read current routes/mod.rs content
current_content=$(cat "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\mod.rs")

# Append new module declarations and route registration
cat >> "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\mod.rs" << 'RUST_EOF'

// GitCortex Workflow routes
pub mod cli_types;
pub mod workflows;

// Note: Add these to your api_routes() function:
// .nest("/cli_types", cli_types::cli_types_routes())
// .nest("/workflows", workflows::workflows_routes())
RUST_EOF
```

**Step 7: Manually update routes/mod.rs to add route registration**

Read the file and update the api_routes function:

```bash
# Find the api_routes function and add the new routes
# This requires manual editing - here's the pattern:
```

In `vibe-kanban-main/crates/server/src/routes/mod.rs`, add to the api_routes function:
```rust
.nest("/cli_types", cli_types::cli_types_routes())
.nest("/workflows", workflows::workflows_routes())
```

**Step 8: Verify server compiles**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build -p server 2>&1 | grep -E "(error|warning|Compiling|Finished)"
```

Expected: "Compiling server v..." followed by "Finished" (no errors)

**Step 9: Generate updated TypeScript types**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo run --bin generate_types 2>&1 | tail -20
```

**Step 10: Commit**

```bash
cd "F:\Project\GitCortex\.worktrees\phase-1-database"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\cli_types.rs"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\workflows.rs"
git add "F:\Project\GitCortex\vibe-kanban-main\crates\server\src\routes\mod.rs"
git commit -m "$(cat <<'EOF'
feat(api): add workflow API routes

Add new route handlers for workflow coordination:
- cli_types.rs: CLI types detection and listing
- workflows.rs: Workflow CRUD and management

API endpoints:
- GET /api/cli_types - List all CLI types
- GET /api/cli_types/detect - Detect installed CLIs
- GET /api/cli_types/:id/models - List CLI models
- GET /api/workflows?project_id=xxx - List workflows
- POST /api/workflows - Create workflow
- GET /api/workflows/:id - Get workflow details
- DELETE /api/workflows/:id - Delete workflow
- PUT /api/workflows/:id/status - Update status
- POST /api/workflows/:id/start - Start workflow
- GET /api/workflows/:id/tasks - List workflow tasks
- GET /api/workflows/presets/commands - List slash commands

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 1.4: Final Testing and Verification

**Step 1: Run full database migration**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo sqlx migrate run --database-url sqlite:sqlite.db
```

Expected: All migrations applied successfully

**Step 2: Verify database schema**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
sqlite3 sqlite.db << 'SQL'
SELECT 'Tables:' as '';
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

SELECT 'CLI Types count:' as '';
SELECT COUNT(*) FROM cli_type;

SELECT 'Model configs count:' as '';
SELECT COUNT(*) FROM model_config;

SELECT 'Slash commands count:' as '';
SELECT COUNT(*) FROM slash_command_preset;
SQL
```

Expected: Shows 9 new tables, 9 CLI types, appropriate number of models and commands

**Step 3: Test build**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
cargo build 2>&1 | tail -30
```

Expected: Full project builds successfully with no errors

**Step 4: Verify TypeScript types generated**

```bash
cd "F:\Project\GitCortex\vibe-kanban-main"
ls -lh shared/types.ts
head -50 shared/types.ts | grep -E "(CliType|Workflow|Terminal|export)"
```

Expected: TypeScript file exists and contains exported types for new models

**Step 5: Update TODO.md progress**

Edit `F:\Project\GitCortex\docs\plans\TODO.md`:
- Change Task 1.1 status from ⬜ to ✅
- Change Task 1.2 status from ⬜ to ✅
- Change Task 1.3 status from ⬜ to ✅
- Change Task 1.4 status from ⬜ to ✅
- Update completion count from 2 to 6
- Update completion percentage to 18.75%

**Step 6: Final commit**

```bash
cd "F:\Project\GitCortex\.worktrees\phase-1-database"
git add "F:\Project\GitCortex\docs\plans\TODO.md"
git commit -m "$(cat <<'EOF'
docs: update TODO.md - Phase 1 Database completed

All Phase 1 tasks completed:
- Task 1.1: Database migration (9 tables) ✅
- Task 1.2: Rust models with TypeScript export ✅
- Task 1.3: API routes ✅
- Task 1.4: Testing and verification ✅

Total progress: 6/32 tasks (18.75%)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

git push origin feature/phase-1-database
```

---

## Acceptance Criteria

Phase 1 is complete when:
- [x] All 9 database tables created with proper indexes
- [x] System data (CLI types, models, slash commands) inserted
- [x] Rust models compile successfully
- [x] TypeScript types generated
- [x] API routes registered and compile
- [x] Full project builds without errors
- [x] TODO.md updated with completion status

---

## Next Steps

After Phase 1 completion, proceed to **Phase 2: CC-Switch Integration** (`03-phase-2-cc-switch.md`).
