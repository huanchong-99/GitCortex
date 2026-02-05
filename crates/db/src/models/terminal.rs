//! Terminal Model
//!
//! Stores terminal configuration and state for each task.

use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, AeadCore, KeyInit, OsRng},
};
use base64::{Engine as _, engine::general_purpose};
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
    #[serde(skip)]
    #[ts(skip)]
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

    /// Associated session ID (NEW FIELD)
    pub session_id: Option<String>,

    /// Associated execution process ID (NEW FIELD)
    pub execution_process_id: Option<String>,

    /// Associated gitcortex session ID
    pub vk_session_id: Option<Uuid>,

    /// Auto-confirm mode: skip CLI permission prompts
    /// When enabled, CLI will be launched with auto-confirm flags:
    /// - Claude Code: --dangerously-skip-permissions
    /// - Codex: --yolo
    /// - Gemini: --yolo
    pub auto_confirm: bool,

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
    /// Auto-confirm mode: skip CLI permission prompts
    #[serde(default)]
    pub auto_confirm: bool,
}

impl Terminal {
    const ENCRYPTION_KEY_ENV: &str = "GITCORTEX_ENCRYPTION_KEY";

    /// Get encryption key from environment variable
    fn get_encryption_key() -> anyhow::Result<[u8; 32]> {
        let key_str = std::env::var(Self::ENCRYPTION_KEY_ENV)
            .map_err(|_| anyhow::anyhow!(
                "Encryption key not found. Please set {} environment variable with a 32-byte value.",
                Self::ENCRYPTION_KEY_ENV
            ))?;

        // Check length FIRST before conversion to prevent zero-padding
        if key_str.len() != 32 {
            return Err(anyhow::anyhow!(
                "Invalid encryption key length: got {} bytes, expected exactly 32 bytes",
                key_str.len()
            ));
        }

        key_str
            .as_bytes()
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid encryption key format"))
    }

    /// Set custom API key with encryption
    pub fn set_custom_api_key(&mut self, plaintext: &str) -> anyhow::Result<()> {
        let key = Self::get_encryption_key()?;
        let cipher = Aes256Gcm::new_from_slice(&key)
            .map_err(|e| anyhow::anyhow!("Invalid encryption key: {e}"))?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {e}"))?;

        // Combine nonce + ciphertext
        let mut combined = nonce.to_vec();
        combined.extend_from_slice(&ciphertext);

        // Base64 encode
        self.custom_api_key = Some(general_purpose::STANDARD.encode(&combined));
        Ok(())
    }

    /// Get custom API key with decryption
    pub fn get_custom_api_key(&self) -> anyhow::Result<Option<String>> {
        match &self.custom_api_key {
            None => Ok(None),
            Some(encoded) => {
                let key = Self::get_encryption_key()?;
                let combined = general_purpose::STANDARD
                    .decode(encoded)
                    .map_err(|e| anyhow::anyhow!("Base64 decode failed: {e}"))?;

                if combined.len() < 12 {
                    return Err(anyhow::anyhow!("Invalid encrypted data length"));
                }

                let (nonce_bytes, ciphertext) = combined.split_at(12);
                #[allow(deprecated)]
                let nonce = Nonce::from_slice(nonce_bytes);
                let cipher = Aes256Gcm::new_from_slice(&key)
                    .map_err(|e| anyhow::anyhow!("Invalid encryption key: {e}"))?;

                let plaintext_bytes = cipher
                    .decrypt(nonce, ciphertext)
                    .map_err(|e| anyhow::anyhow!("Decryption failed: {e}"))?;

                Ok(Some(String::from_utf8(plaintext_bytes).map_err(|e| {
                    anyhow::anyhow!("Invalid UTF-8 in decrypted data: {e}")
                })?))
            }
        }
    }

    /// Create terminal
    pub async fn create(pool: &SqlitePool, terminal: &Terminal) -> sqlx::Result<Self> {
        sqlx::query_as::<_, Terminal>(
            r"
            INSERT INTO terminal (
                id, workflow_task_id, cli_type_id, model_config_id,
                custom_base_url, custom_api_key, role, role_description,
                order_index, status, auto_confirm, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
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
        .bind(terminal.auto_confirm)
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

    /// Update terminal session binding
    pub async fn update_session(
        pool: &SqlitePool,
        id: &str,
        session_id: Option<&str>,
        execution_process_id: Option<&str>,
    ) -> sqlx::Result<()> {
        let now = Utc::now();
        sqlx::query(
            r"
            UPDATE terminal
            SET session_id = ?, execution_process_id = ?, updated_at = ?
            WHERE id = ?
            "
        )
        .bind(session_id)
        .bind(execution_process_id)
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
        let status = TerminalStatus::Waiting.to_string();
        sqlx::query(
            r"
            UPDATE terminal
            SET status = ?, started_at = ?, updated_at = ?
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

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    fn with_var<F>(key: &str, value: Option<&str>, f: F)
    where
        F: FnOnce(),
    {
        if let Some(v) = value {
            unsafe { std::env::set_var(key, v) };
        } else {
            unsafe { std::env::remove_var(key) };
        }
        f();
        if value.is_some() {
            unsafe { std::env::remove_var(key) };
        }
    }

    #[test]
    #[serial]
    fn test_custom_api_key_encryption_roundtrip() {
        with_var(
            "GITCORTEX_ENCRYPTION_KEY",
            Some("12345678901234567890123456789012"),
            || {
                let mut terminal = Terminal {
                    id: Uuid::new_v4().to_string(),
                    workflow_task_id: "task-1".to_string(),
                    cli_type_id: "cli-1".to_string(),
                    model_config_id: "model-1".to_string(),
                    custom_base_url: Some("https://api.test.com".to_string()),
                    custom_api_key: None,
                    role: Some("coder".to_string()),
                    role_description: None,
                    order_index: 0,
                    status: "not_started".to_string(),
                    process_id: None,
                    pty_session_id: None,
                    session_id: None,
                    execution_process_id: None,
                    vk_session_id: None,
                    auto_confirm: false,
                    last_commit_hash: None,
                    last_commit_message: None,
                    started_at: None,
                    completed_at: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                let original_key = "sk-test-terminal-key-12345";

                // Encrypt the API key
                terminal
                    .set_custom_api_key(original_key)
                    .expect("Encryption should succeed");

                // Verify the stored value is encrypted (not plaintext)
                assert!(terminal.custom_api_key.is_some());
                let stored = terminal.custom_api_key.as_ref().unwrap();
                assert_ne!(stored, original_key);
                assert!(!stored.contains("sk-test"));

                // Decrypt and verify
                let decrypted_key = terminal
                    .get_custom_api_key()
                    .expect("Decryption should succeed")
                    .expect("Decrypted key should exist");
                assert_eq!(decrypted_key, original_key);
            },
        );
    }

    #[test]
    #[serial]
    fn test_custom_api_key_encryption_missing_env_key() {
        with_var("GITCORTEX_ENCRYPTION_KEY", Option::<&str>::None, || {
            let mut terminal = Terminal {
                id: Uuid::new_v4().to_string(),
                workflow_task_id: "task-1".to_string(),
                cli_type_id: "cli-1".to_string(),
                model_config_id: "model-1".to_string(),
                custom_base_url: None,
                custom_api_key: None,
                role: None,
                role_description: None,
                order_index: 0,
                status: "not_started".to_string(),
                process_id: None,
                pty_session_id: None,
                session_id: None,
                execution_process_id: None,
                vk_session_id: None,
                auto_confirm: false,
                last_commit_hash: None,
                last_commit_message: None,
                started_at: None,
                completed_at: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            // Should fail without encryption key
            let result = terminal.set_custom_api_key("sk-test");
            assert!(result.is_err());
            assert!(result
                .unwrap_err()
                .to_string()
                .contains("GITCORTEX_ENCRYPTION_KEY"));
        });
    }

    #[test]
    #[serial]
    fn test_custom_api_key_encryption_invalid_key_length() {
        with_var("GITCORTEX_ENCRYPTION_KEY", Some("short"), || {
            let mut terminal = Terminal {
                id: Uuid::new_v4().to_string(),
                workflow_task_id: "task-1".to_string(),
                cli_type_id: "cli-1".to_string(),
                model_config_id: "model-1".to_string(),
                custom_base_url: None,
                custom_api_key: None,
                role: None,
                role_description: None,
                order_index: 0,
                status: "not_started".to_string(),
                process_id: None,
                pty_session_id: None,
                session_id: None,
                execution_process_id: None,
                vk_session_id: None,
                auto_confirm: false,
                last_commit_hash: None,
                last_commit_message: None,
                started_at: None,
                completed_at: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            let result = terminal.set_custom_api_key("sk-test");
            assert!(result.is_err());
            assert!(result.unwrap_err().to_string().contains("32 bytes"));
        });
    }

    #[test]
    #[serial]
    fn test_custom_api_key_none_returns_none() {
        with_var(
            "GITCORTEX_ENCRYPTION_KEY",
            Some("12345678901234567890123456789012"),
            || {
                let terminal = Terminal {
                    id: Uuid::new_v4().to_string(),
                    workflow_task_id: "task-1".to_string(),
                    cli_type_id: "cli-1".to_string(),
                    model_config_id: "model-1".to_string(),
                    custom_base_url: None,
                    custom_api_key: None,
                    role: None,
                    role_description: None,
                    order_index: 0,
                    status: "not_started".to_string(),
                    process_id: None,
                    pty_session_id: None,
                    session_id: None,
                    execution_process_id: None,
                    vk_session_id: None,
                    auto_confirm: false,
                    last_commit_hash: None,
                    last_commit_message: None,
                    started_at: None,
                    completed_at: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                let key = terminal.get_custom_api_key().unwrap();
                assert!(key.is_none());
            },
        );
    }

    #[test]
    #[serial]
    fn test_custom_api_key_serialization_skips_encrypted() {
        with_var(
            "GITCORTEX_ENCRYPTION_KEY",
            Some("12345678901234567890123456789012"),
            || {
                let mut terminal = Terminal {
                    id: Uuid::new_v4().to_string(),
                    workflow_task_id: "task-1".to_string(),
                    cli_type_id: "cli-1".to_string(),
                    model_config_id: "model-1".to_string(),
                    custom_base_url: None,
                    custom_api_key: None,
                    role: None,
                    role_description: None,
                    order_index: 0,
                    status: "not_started".to_string(),
                    process_id: None,
                    pty_session_id: None,
                    session_id: None,
                    execution_process_id: None,
                    vk_session_id: None,
                    auto_confirm: false,
                    last_commit_hash: None,
                    last_commit_message: None,
                    started_at: None,
                    completed_at: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                terminal.set_custom_api_key("sk-test").unwrap();

                // Serialize to JSON
                let json = serde_json::to_string(&terminal).unwrap();

                // Encrypted field should not be in JSON (due to #[serde(skip)])
                assert!(!json.contains("custom_api_key"));
                assert!(!json.contains("sk-test"));
            },
        );
    }

    #[test]
    #[serial]
    fn test_custom_api_key_dto_masks_sensitive_data() {
        // Test that DTO never exposes API keys
        // Note: This test will be implemented in the server crate where TerminalDto is defined
        // Here we just verify the encryption/decryption works

        with_var(
            "GITCORTEX_ENCRYPTION_KEY",
            Some("12345678901234567890123456789012"),
            || {
                let mut terminal = Terminal {
                    id: "term-1".to_string(),
                    workflow_task_id: "task-1".to_string(),
                    cli_type_id: "cli-1".to_string(),
                    model_config_id: "model-1".to_string(),
                    custom_base_url: Some("https://api.test.com".to_string()),
                    custom_api_key: None,
                    role: Some("coder".to_string()),
                    role_description: None,
                    order_index: 0,
                    status: "not_started".to_string(),
                    process_id: None,
                    pty_session_id: None,
                    session_id: None,
                    execution_process_id: None,
                    vk_session_id: None,
                    auto_confirm: false,
                    last_commit_hash: None,
                    last_commit_message: None,
                    started_at: None,
                    completed_at: None,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                terminal.set_custom_api_key("sk-secret-key").unwrap();

                // Verify the key is encrypted in storage
                assert!(terminal.custom_api_key.is_some());
                let stored = terminal.custom_api_key.as_ref().unwrap();
                assert!(!stored.contains("sk-secret-key"));

                // Verify we can decrypt it
                let decrypted = terminal.get_custom_api_key().unwrap().unwrap();
                assert_eq!(decrypted, "sk-secret-key");

                // Verify serialization doesn't expose it (due to #[serde(skip)])
                let json = serde_json::to_string(&terminal).unwrap();
                assert!(!json.contains("sk-secret-key"));
                assert!(!json.contains("custom_api_key"));
            },
        );
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
