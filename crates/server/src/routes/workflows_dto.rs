//! Workflow API DTOs with explicit camelCase serialization
//!
//! This module defines the API contract for Workflow responses.
//! All structs use explicit field mappings (no flatten) to prevent conflicts.

use serde::{Deserialize, Serialize};
use db::models::{SlashCommandPreset, WorkflowCommand};

/// Workflow detail response DTO
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDetailDto {
    // Basic workflow fields
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub use_slash_commands: bool,
    pub orchestrator_enabled: bool,
    pub orchestrator_api_type: Option<String>,
    pub orchestrator_base_url: Option<String>,
    pub orchestrator_model: Option<String>,
    pub error_terminal_enabled: bool,
    pub error_terminal_cli_id: Option<String>,
    pub error_terminal_model_id: Option<String>,
    pub merge_terminal_cli_id: Option<String>,
    pub merge_terminal_model_id: Option<String>,
    pub target_branch: String,

    // Timestamps
    pub ready_at: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,

    // Nested data
    pub tasks: Vec<WorkflowTaskDto>,
    pub commands: Vec<WorkflowCommandDto>,
}

/// Workflow task DTO
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowTaskDto {
    pub id: String,
    pub workflow_id: String,
    pub vk_task_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub branch: String,
    pub status: String,
    pub order_index: i32,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub terminals: Vec<TerminalDto>,
}

/// Terminal DTO
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDto {
    pub id: String,
    pub workflow_task_id: String,
    pub cli_type_id: String,
    pub model_config_id: String,
    pub custom_base_url: Option<String>,
    pub custom_api_key: Option<String>,
    pub role: Option<String>,
    pub role_description: Option<String>,
    pub order_index: i32,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Workflow command DTO
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowCommandDto {
    pub id: String,
    pub workflow_id: String,
    pub preset_id: String,
    pub order_index: i32,
    pub custom_params: Option<String>,
    pub created_at: String,
    pub preset: SlashCommandPresetDto,
}

/// Slash command preset DTO
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SlashCommandPresetDto {
    pub id: String,
    pub command: String,
    pub description: String,
    pub prompt_template: String,
    pub is_system: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Workflow list item DTO (simplified for list view)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowListItemDto {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub tasks_count: i32,
    pub terminals_count: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workflow_detail_dto_serialization() {
        let dto = WorkflowDetailDto {
            id: "wf-test".to_string(),
            project_id: "proj-test".to_string(),
            name: "Test Workflow".to_string(),
            description: Some("Test description".to_string()),
            status: "created".to_string(),
            use_slash_commands: true,
            orchestrator_enabled: true,
            orchestrator_api_type: Some("openai-compatible".to_string()),
            orchestrator_base_url: Some("https://api.test.com".to_string()),
            orchestrator_model: Some("gpt-4o".to_string()),
            error_terminal_enabled: true,
            error_terminal_cli_id: Some("cli-test".to_string()),
            error_terminal_model_id: Some("model-test".to_string()),
            merge_terminal_cli_id: Some("cli-merge".to_string()),
            merge_terminal_model_id: Some("model-merge".to_string()),
            target_branch: "main".to_string(),
            ready_at: None,
            started_at: None,
            completed_at: None,
            created_at: "2026-01-24T10:00:00Z".to_string(),
            updated_at: "2026-01-24T10:00:00Z".to_string(),
            tasks: vec![],
            commands: vec![],
        };

        let json = serde_json::to_string(&dto).unwrap();

        // Verify camelCase serialization
        assert!(json.contains("\"projectId\""));
        assert!(json.contains("\"useSlashCommands\""));
        assert!(json.contains("\"orchestratorEnabled\""));
        assert!(json.contains("\"createdAt\""));
        assert!(json.contains("\"updatedAt\""));

        // Verify no snake_case
        assert!(!json.contains("\"project_id\""));
        assert!(!json.contains("\"use_slash_commands\""));
        assert!(!json.contains("\"created_at\""));
    }

    #[test]
    fn test_status_enum_valid_values() {
        let valid_statuses = vec![
            "created", "starting", "ready", "running",
            "paused", "merging", "completed", "failed", "cancelled"
        ];

        for status in valid_statuses {
            let dto = WorkflowDetailDto {
                id: "wf-test".to_string(),
                project_id: "proj-test".to_string(),
                name: "Test".to_string(),
                description: None,
                status: status.to_string(),
                use_slash_commands: false,
                orchestrator_enabled: false,
                orchestrator_api_type: None,
                orchestrator_base_url: None,
                orchestrator_model: None,
                error_terminal_enabled: false,
                error_terminal_cli_id: None,
                error_terminal_model_id: None,
                merge_terminal_cli_id: None,
                merge_terminal_model_id: None,
                target_branch: "main".to_string(),
                ready_at: None,
                started_at: None,
                completed_at: None,
                created_at: "2026-01-24T10:00:00Z".to_string(),
                updated_at: "2026-01-24T10:00:00Z".to_string(),
                tasks: vec![],
                commands: vec![],
            };

            let json = serde_json::to_string(&dto).unwrap();
            assert!(json.contains(&format!("\"status\":\"{}\"", status)));
        }
    }

    #[test]
    fn test_task_status_enum_valid_values() {
        let valid_statuses = vec![
            "pending", "running", "review_pending", "completed", "failed", "cancelled"
        ];

        for status in valid_statuses {
            let dto = WorkflowTaskDto {
                id: "task-test".to_string(),
                workflow_id: "wf-test".to_string(),
                vk_task_id: None,
                name: "Test Task".to_string(),
                description: None,
                branch: "workflow/test".to_string(),
                status: status.to_string(),
                order_index: 0,
                started_at: None,
                completed_at: None,
                created_at: "2026-01-24T10:00:00Z".to_string(),
                updated_at: "2026-01-24T10:00:00Z".to_string(),
                terminals: vec![],
            };

            let json = serde_json::to_string(&dto).unwrap();
            assert!(json.contains(&format!("\"status\":\"{}\"", status)));
        }
    }
}
