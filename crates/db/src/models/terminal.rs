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
#[derive(Debug, Clone, Copy, PartialEq, Eq, Type, Serialize, Deserialize, TS, EnumString, Display, Default)]
#[sqlx(type_name = "terminal_status", rename_all = "lowercase")]
#[serde(rename_all = "snake_case")]
#[strum(serialize_all = "lowercase")]
pub enum TerminalStatus {
    /// Not started
    #[default]
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

/// Terminal
///
/// Corresponds to database table: terminal
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
            r"
            INSERT INTO terminal (
                id, workflow_task_id, cli_type_id, model_config_id,
                custom_base_url, custom_api_key, role, role_description,
                order_index, status, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            RETURNING *
            "
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
            r"SELECT * FROM terminal WHERE id = ?"
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Find terminals by task
    pub async fn find_by_task(pool: &SqlitePool, workflow_task_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, Terminal>(
            r"
            SELECT * FROM terminal
            WHERE workflow_task_id = ?
            ORDER BY order_index ASC
            "
        )
        .bind(workflow_task_id)
        .fetch_all(pool)
        .await
    }

    /// Find terminals by workflow (across tasks)
    pub async fn find_by_workflow(pool: &SqlitePool, workflow_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, Terminal>(
            r"
            SELECT t.* FROM terminal t
            INNER JOIN workflow_task wt ON t.workflow_task_id = wt.id
            WHERE wt.workflow_id = ?
            ORDER BY wt.order_index ASC, t.order_index ASC
            "
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
    }

    /// Update terminal status
    pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r"
            UPDATE terminal
            SET status = ?, updated_at = ?
            WHERE id = ?
            "
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
            r"
            UPDATE terminal
            SET process_id = ?, pty_session_id = ?, updated_at = ?
            WHERE id = ?
            "
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
            r"
            UPDATE terminal
            SET last_commit_hash = ?, last_commit_message = ?, updated_at = ?
            WHERE id = ?
            "
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
            r"
            UPDATE terminal
            SET status = 'waiting', started_at = ?, updated_at = ?
            WHERE id = ?
            "
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
            r"
            UPDATE terminal
            SET status = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
            "
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
            r"
            INSERT INTO terminal_log (id, terminal_id, log_type, content, created_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            RETURNING *
            "
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
            r"
            SELECT * FROM terminal_log
            WHERE terminal_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "
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
            r"
            INSERT INTO git_event (
                id, workflow_id, terminal_id, commit_hash, branch,
                commit_message, metadata, process_status, created_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8)
            RETURNING *
            "
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
            r"
            SELECT * FROM git_event
            WHERE workflow_id = ? AND process_status = 'pending'
            ORDER BY created_at ASC
            "
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
            r"
            UPDATE git_event
            SET process_status = ?, agent_response = ?, processed_at = ?
            WHERE id = ?
            "
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
