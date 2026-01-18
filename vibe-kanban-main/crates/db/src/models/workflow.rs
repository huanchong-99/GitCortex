//! Workflow Model
//!
//! Stores workflow configuration and state for multi-terminal orchestration.

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce, Key
};
use base64::{Engine as _, engine::general_purpose};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool, Type};
use strum_macros::{Display, EnumString};
use ts_rs::TS;
use uuid::Uuid;

// Import Terminal type for batch operations
use super::terminal::Terminal;

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
#[serde(rename_all = "camelCase")]
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
    #[serde(skip_serializing)]
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

impl Workflow {
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

        key_str.as_bytes()
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid encryption key format"))
    }

    /// Set API key with encryption
    pub fn set_api_key(&mut self, plaintext: &str) -> anyhow::Result<()> {
        let key = Self::get_encryption_key()?;
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

        let ciphertext = cipher.encrypt(&nonce, plaintext.as_bytes())
            .map_err(|e| anyhow::anyhow!("Encryption failed: {}", e))?;

        // Combine nonce + ciphertext
        let mut combined = nonce.to_vec();
        combined.extend_from_slice(&ciphertext);

        // Base64 encode
        self.orchestrator_api_key = Some(
            general_purpose::STANDARD.encode(&combined)
        );

        tracing::debug!("API key encrypted for workflow {}", self.id);
        Ok(())
    }

    /// Get API key with decryption
    pub fn get_api_key(&self) -> anyhow::Result<Option<String>> {
        match &self.orchestrator_api_key {
            None => Ok(None),
            Some(encoded) => {
                let key = Self::get_encryption_key()?;
                let combined = general_purpose::STANDARD.decode(encoded)
                    .map_err(|e| anyhow::anyhow!("Base64 decode failed: {}", e))?;

                if combined.len() < 12 {
                    return Err(anyhow::anyhow!("Invalid encrypted data length"));
                }

                let (nonce_bytes, ciphertext) = combined.split_at(12);
                let nonce = Nonce::from_slice(nonce_bytes);
                let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));

                let plaintext_bytes = cipher.decrypt(nonce, ciphertext)
                    .map_err(|e| anyhow::anyhow!("Decryption failed: {}", e))?;

                Ok(Some(String::from_utf8(plaintext_bytes)
                    .map_err(|e| anyhow::anyhow!("Invalid UTF-8 in decrypted data: {}", e))?))
            }
        }
    }
}

/// Workflow Task
///
/// Corresponds to database table: workflow_task
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct OrchestratorConfig {
    pub api_type: String,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

/// Terminal Configuration
#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
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

    /// Create workflow with tasks and terminals in a single transaction
    ///
    /// This is a batch operation that creates a workflow along with its associated
    /// workflow tasks and terminals atomically. If any part fails, the entire
    /// transaction is rolled back.
    pub async fn create_with_tasks(
        pool: &SqlitePool,
        workflow: &Workflow,
        tasks: Vec<(WorkflowTask, Vec<Terminal>)>,
    ) -> anyhow::Result<()> {
        let mut tx = pool.begin().await?;

        // Create workflow
        sqlx::query(
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
        .execute(&mut *tx)
        .await?;

        // Create tasks and terminals
        for (task, terminals) in tasks {
            sqlx::query(
                r#"
                INSERT INTO workflow_task (
                    id, workflow_id, vk_task_id, name, description,
                    branch, status, order_index, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
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
            .execute(&mut *tx)
            .await?;

            // Create terminals for this task
            for terminal in terminals {
                sqlx::query(
                    r#"
                    INSERT INTO terminal (
                        id, workflow_task_id, cli_type_id, model_config_id,
                        custom_base_url, custom_api_key, role, role_description,
                        order_index, status, created_at, updated_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
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
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;
        Ok(())
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

#[cfg(test)]
mod encryption_tests {
    use super::*;

    #[test]
    fn test_api_key_encryption_decryption() {
        // Setup encryption key
        unsafe { std::env::set_var("GITCORTEX_ENCRYPTION_KEY", "12345678901234567890123456789012"); }

        let mut workflow = Workflow {
            id: "test-workflow".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: None,
            status: "pending".to_string(),
            use_slash_commands: false,
            orchestrator_enabled: false,
            orchestrator_api_type: None,
            orchestrator_base_url: None,
            orchestrator_api_key: None,
            orchestrator_model: None,
            error_terminal_enabled: false,
            error_terminal_cli_id: None,
            error_terminal_model_id: None,
            merge_terminal_cli_id: "merge-cli".to_string(),
            merge_terminal_model_id: "merge-model".to_string(),
            target_branch: "main".to_string(),
            ready_at: None,
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        // Test encryption
        let original_key = "sk-test-key-12345";
        workflow.set_api_key(original_key).unwrap();

        assert!(workflow.orchestrator_api_key.is_some());
        assert_ne!(
            workflow.orchestrator_api_key.as_ref().unwrap(),
            original_key,
            "Encrypted key should not match original"
        );

        // Test decryption
        let decrypted_key = workflow.get_api_key().unwrap().unwrap();
        assert_eq!(decrypted_key, original_key);
    }

    #[test]
    fn test_api_key_encryption_missing_env_key() {
        // Clear environment variable and ensure it's not set
        unsafe {
            std::env::remove_var("GITCORTEX_ENCRYPTION_KEY");
            // Double-check it's really gone
            assert!(std::env::var("GITCORTEX_ENCRYPTION_KEY").is_err());
        }

        let mut workflow = Workflow {
            id: "test-workflow".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: None,
            status: "pending".to_string(),
            use_slash_commands: false,
            orchestrator_enabled: false,
            orchestrator_api_type: None,
            orchestrator_base_url: None,
            orchestrator_api_key: None,
            orchestrator_model: None,
            error_terminal_enabled: false,
            error_terminal_cli_id: None,
            error_terminal_model_id: None,
            merge_terminal_cli_id: "merge-cli".to_string(),
            merge_terminal_model_id: "merge-model".to_string(),
            target_branch: "main".to_string(),
            ready_at: None,
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        // Should fail without encryption key
        let result = workflow.set_api_key("sk-test");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("GITCORTEX_ENCRYPTION_KEY"));
    }

    #[test]
    fn test_api_key_encryption_invalid_key_length() {
        // Set invalid key (too short)
        unsafe {
            std::env::set_var("GITCORTEX_ENCRYPTION_KEY", "short");
            // Verify it was set
            assert_eq!(std::env::var("GITCORTEX_ENCRYPTION_KEY").unwrap(), "short");
        }

        let mut workflow = Workflow {
            id: "test-workflow".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: None,
            status: "pending".to_string(),
            use_slash_commands: false,
            orchestrator_enabled: false,
            orchestrator_api_type: None,
            orchestrator_base_url: None,
            orchestrator_api_key: None,
            orchestrator_model: None,
            error_terminal_enabled: false,
            error_terminal_cli_id: None,
            error_terminal_model_id: None,
            merge_terminal_cli_id: "merge-cli".to_string(),
            merge_terminal_model_id: "merge-model".to_string(),
            target_branch: "main".to_string(),
            ready_at: None,
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let result = workflow.set_api_key("sk-test");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("32 bytes"));
    }

    #[test]
    fn test_api_key_none_when_not_set() {
        unsafe { std::env::set_var("GITCORTEX_ENCRYPTION_KEY", "12345678901234567890123456789012"); }

        let workflow = Workflow {
            id: "test-workflow".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: None,
            status: "pending".to_string(),
            use_slash_commands: false,
            orchestrator_enabled: false,
            orchestrator_api_type: None,
            orchestrator_base_url: None,
            orchestrator_api_key: None,
            orchestrator_model: None,
            error_terminal_enabled: false,
            error_terminal_cli_id: None,
            error_terminal_model_id: None,
            merge_terminal_cli_id: "merge-cli".to_string(),
            merge_terminal_model_id: "merge-model".to_string(),
            target_branch: "main".to_string(),
            ready_at: None,
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let key = workflow.get_api_key().unwrap();
        assert!(key.is_none());
    }

    #[test]
    fn test_api_key_serialization_skips_encrypted() {
        unsafe { std::env::set_var("GITCORTEX_ENCRYPTION_KEY", "12345678901234567890123456789012"); }

        let mut workflow = Workflow {
            id: "test-workflow".to_string(),
            project_id: "test-project".to_string(),
            name: "Test Workflow".to_string(),
            description: None,
            status: "pending".to_string(),
            use_slash_commands: false,
            orchestrator_enabled: false,
            orchestrator_api_type: None,
            orchestrator_base_url: None,
            orchestrator_api_key: None,
            orchestrator_model: None,
            error_terminal_enabled: false,
            error_terminal_cli_id: None,
            error_terminal_model_id: None,
            merge_terminal_cli_id: "merge-cli".to_string(),
            merge_terminal_model_id: "merge-model".to_string(),
            target_branch: "main".to_string(),
            ready_at: None,
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        workflow.set_api_key("sk-test").unwrap();

        // Serialize to JSON
        let json = serde_json::to_string(&workflow).unwrap();

        // Encrypted field should not be in JSON (due to #[serde(skip_serializing)])
        assert!(!json.contains("orchestrator_api_key"));
        assert!(!json.contains("sk-test"));
    }
}
