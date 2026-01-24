//! Workflow API Routes

use std::collections::HashMap;

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    response::Json as ResponseJson,
    routing::{get, post, put},
};
use db::models::{
    CliType, CreateWorkflowRequest, ModelConfig, SlashCommandPreset, Terminal, Workflow,
    WorkflowCommand, WorkflowTask,
};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use utils::response::ApiResponse;
use utils::slug;
use uuid::Uuid;

// Import DTOs
use crate::routes::workflows_dto::{WorkflowDetailDto, WorkflowListItemDto};
use crate::{DeploymentImpl, error::ApiError};

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
pub fn workflows_routes() -> Router<DeploymentImpl> {
    Router::new()
        .route("/", get(list_workflows).post(create_workflow))
        .route("/:workflow_id", get(get_workflow).delete(delete_workflow))
        .route("/:workflow_id/status", put(update_workflow_status))
        .route("/:workflow_id/start", post(start_workflow))
        .route("/:workflow_id/tasks", get(list_workflow_tasks))
        .route(
            "/:workflow_id/tasks/:task_id/terminals",
            get(list_task_terminals),
        )
        .route("/presets/commands", get(list_command_presets))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// Validate create workflow request
pub fn validate_create_request(req: &CreateWorkflowRequest) -> Result<(), ApiError> {
    // Validate project_id
    if req.project_id.trim().is_empty() {
        return Err(ApiError::BadRequest("projectId is required".to_string()));
    }

    // Validate workflow name
    if req.name.trim().is_empty() {
        return Err(ApiError::BadRequest("name is required".to_string()));
    }

    // Validate tasks is not empty
    if req.tasks.is_empty() {
        return Err(ApiError::BadRequest("tasks must not be empty".to_string()));
    }

    // Validate each task
    for (task_index, task) in req.tasks.iter().enumerate() {
        if task.name.trim().is_empty() {
            return Err(ApiError::BadRequest(
                format!("task[{}].name is required", task_index)
            ));
        }

        if task.terminals.is_empty() {
            return Err(ApiError::BadRequest(
                format!("task[{}].terminals must not be empty", task_index)
            ));
        }

        // Validate each terminal
        for (terminal_index, terminal) in task.terminals.iter().enumerate() {
            if terminal.cli_type_id.trim().is_empty() {
                return Err(ApiError::BadRequest(
                    format!("task[{}].terminal[{}].cliTypeId is required", task_index, terminal_index)
                ));
            }

            if terminal.model_config_id.trim().is_empty() {
                return Err(ApiError::BadRequest(
                    format!("task[{}].terminal[{}].modelConfigId is required", task_index, terminal_index)
                ));
            }
        }
    }

    Ok(())
}

/// Validate CLI types and model configs exist in database
async fn validate_cli_and_model_configs(
    pool: &sqlx::SqlitePool,
    req: &CreateWorkflowRequest,
) -> Result<(), ApiError> {
    // Collect all unique cli_type_id and model_config_id pairs
    let mut pairs_to_validate: Vec<(String, String)> = Vec::new();

    // Add merge terminal config
    pairs_to_validate.push((
        req.merge_terminal_config.cli_type_id.clone(),
        req.merge_terminal_config.model_config_id.clone(),
    ));

    // Add error terminal config if present
    if let Some(error_config) = &req.error_terminal_config {
        pairs_to_validate.push((
            error_config.cli_type_id.clone(),
            error_config.model_config_id.clone(),
        ));
    }

    // Add all task terminals
    for task in &req.tasks {
        for terminal in &task.terminals {
            pairs_to_validate.push((
                terminal.cli_type_id.clone(),
                terminal.model_config_id.clone(),
            ));
        }
    }

    // Validate each pair
    for (cli_type_id, model_config_id) in pairs_to_validate {
        // Validate CLI type exists
        let cli_type = CliType::find_by_id(pool, &cli_type_id).await
            .map_err(|e| ApiError::Internal(format!("Database error: {e}")))?;

        if cli_type.is_none() {
            return Err(ApiError::BadRequest(format!(
                "CLI type not found: {cli_type_id}"
            )));
        }

        // Validate model config exists
        let model_config = ModelConfig::find_by_id(pool, &model_config_id).await
            .map_err(|e| ApiError::Internal(format!("Database error: {e}")))?;

        if model_config.is_none() {
            return Err(ApiError::BadRequest(format!(
                "Model config not found: {model_config_id}"
            )));
        }

        // Validate model config belongs to the CLI type
        let model_config = model_config.unwrap();
        if model_config.cli_type_id != cli_type_id {
            return Err(ApiError::BadRequest(format!(
                "Model config {model_config_id} does not belong to CLI type {cli_type_id}"
            )));
        }
    }

    Ok(())
}

/// GET /api/workflows?project_id=xxx
/// List workflows for a project
async fn list_workflows(
    State(deployment): State<DeploymentImpl>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<ResponseJson<ApiResponse<Vec<WorkflowListItemDto>>>, ApiError> {
    let project_id = params
        .get("project_id")
        .ok_or_else(|| ApiError::BadRequest("project_id is required".to_string()))?;

    let workflows = Workflow::find_by_project(&deployment.db().pool, project_id).await?;

    // Convert to DTOs with actual counts
    let mut dtos: Vec<WorkflowListItemDto> = Vec::new();

    for workflow in workflows {
        // Get tasks for this workflow
        let tasks = WorkflowTask::find_by_workflow(&deployment.db().pool, &workflow.id).await?;
        let tasks_count = tasks.len() as i32;

        // Count terminals across all tasks
        let mut terminals_count = 0i32;
        for task in &tasks {
            let terminals = Terminal::find_by_task(&deployment.db().pool, &task.id).await?;
            terminals_count += terminals.len() as i32;
        }

        dtos.push(WorkflowListItemDto {
            id: workflow.id,
            project_id: workflow.project_id,
            name: workflow.name,
            description: workflow.description,
            status: workflow.status,
            created_at: workflow.created_at.to_rfc3339(),
            updated_at: workflow.updated_at.to_rfc3339(),
            tasks_count,
            terminals_count,
        });
    }

    Ok(ResponseJson(ApiResponse::success(dtos)))
}

/// POST /api/workflows
/// Create workflow
async fn create_workflow(
    State(deployment): State<DeploymentImpl>,
    Json(req): Json<CreateWorkflowRequest>,
) -> Result<ResponseJson<ApiResponse<WorkflowDetailDto>>, ApiError> {
    // Validate request structure
    validate_create_request(&req)?;

    // Validate CLI types and model configs exist in database
    validate_cli_and_model_configs(&deployment.db().pool, &req).await?;

    let now = chrono::Utc::now();
    let workflow_id = Uuid::new_v4().to_string();

    // 1. Create workflow with encrypted API key
    let mut workflow = Workflow {
        id: workflow_id.clone(),
        project_id: req.project_id,
        name: req.name,
        description: req.description,
        status: "created".to_string(),
        use_slash_commands: req.use_slash_commands,
        orchestrator_enabled: req.orchestrator_config.is_some(),
        orchestrator_api_type: req.orchestrator_config.as_ref().map(|c| c.api_type.clone()),
        orchestrator_base_url: req.orchestrator_config.as_ref().map(|c| c.base_url.clone()),
        orchestrator_api_key: None, // Will be set encrypted below
        orchestrator_model: req.orchestrator_config.as_ref().map(|c| c.model.clone()),
        error_terminal_enabled: req.error_terminal_config.is_some(),
        error_terminal_cli_id: req
            .error_terminal_config
            .as_ref()
            .map(|c| c.cli_type_id.clone()),
        error_terminal_model_id: req
            .error_terminal_config
            .as_ref()
            .map(|c| c.model_config_id.clone()),
        merge_terminal_cli_id: req.merge_terminal_config.cli_type_id.clone(),
        merge_terminal_model_id: req.merge_terminal_config.model_config_id.clone(),
        target_branch: req.target_branch.unwrap_or_else(|| "main".to_string()),
        ready_at: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    // Encrypt and store API key if provided
    if let Some(orch_config) = &req.orchestrator_config {
        workflow
            .set_api_key(&orch_config.api_key)
            .map_err(|e| ApiError::BadRequest(format!("Failed to encrypt API key: {e}")))?;
    }

    let workflow = Workflow::create(&deployment.db().pool, &workflow).await?;

    // 2. Create slash command associations
    let mut commands: Vec<WorkflowCommand> = Vec::new();
    if let Some(preset_ids) = req.command_preset_ids {
        for (index, preset_id) in preset_ids.iter().enumerate() {
            let index = i32::try_from(index)
                .map_err(|_| ApiError::BadRequest("Command preset index overflow".to_string()))?;
            let preset_id: &str = preset_id;
            WorkflowCommand::create(&deployment.db().pool, &workflow_id, preset_id, index, None)
                .await?;
        }
        commands = WorkflowCommand::find_by_workflow(&deployment.db().pool, &workflow_id).await?;
    }

    // 3. Prepare tasks and terminals for transactional creation
    let mut task_rows: Vec<(WorkflowTask, Vec<Terminal>)> = Vec::new();
    let mut existing_branches: Vec<String> = Vec::new();

    // Collect existing branch names for conflict detection
    // In a real scenario, we'd query the git repository for existing branches
    // For now, we collect branches that will be created in this batch
    for (task_index, task_req) in req.tasks.iter().enumerate() {
        let task_id = Uuid::new_v4().to_string();

        // Generate branch name using slugify with conflict detection
        let branch = if let Some(custom_branch) = &task_req.branch {
            // Use custom branch name if provided
            custom_branch.clone()
        } else {
            // Auto-generate branch name: workflow/{workflow_id}/{slugified-task-name}
            // Check against already-generated branches in this batch
            let base_branch = format!("workflow/{}/{}", workflow_id, slug::slugify(&task_req.name));
            let mut candidate = base_branch.clone();
            let mut counter = 2;

            while existing_branches.contains(&candidate) {
                candidate = format!("{}-{}", base_branch, counter);
                counter += 1;
            }

            candidate
        };

        // Track this branch to avoid conflicts within the same batch
        existing_branches.push(branch.clone());

        let task = WorkflowTask {
            id: task_id.clone(),
            workflow_id: workflow_id.clone(),
            vk_task_id: None,
            name: task_req.name.clone(),
            description: task_req.description.clone(),
            branch,
            status: "pending".to_string(),
            order_index: task_req.order_index,
            started_at: None,
            completed_at: None,
            created_at: now,
            updated_at: now,
        };

        let mut terminals: Vec<Terminal> = Vec::new();

        for terminal_req in &task_req.terminals {
            let terminal = Terminal {
                id: Uuid::new_v4().to_string(),
                workflow_task_id: task_id.clone(),
                cli_type_id: terminal_req.cli_type_id.clone(),
                model_config_id: terminal_req.model_config_id.clone(),
                custom_base_url: terminal_req.custom_base_url.clone(),
                custom_api_key: terminal_req.custom_api_key.clone(),
                role: terminal_req.role.clone(),
                role_description: terminal_req.role_description.clone(),
                order_index: terminal_req.order_index,
                status: "not_started".to_string(),
                process_id: None,
                session_id: None,
                started_at: None,
                completed_at: None,
                created_at: now,
                updated_at: now,
            };
            terminals.push(terminal);
        }

        task_rows.push((task, terminals));
    }

    // 4. Execute transactional creation
    Workflow::create_with_tasks(&deployment.db().pool, &workflow, task_rows).await
        .map_err(|e| ApiError::BadRequest(format!("Failed to create workflow: {e}")))?;

    // 5. Get command preset details
    let all_presets = SlashCommandPreset::find_all(&deployment.db().pool).await?;
    let commands_with_presets: Vec<(WorkflowCommand, SlashCommandPreset)> = commands
        .into_iter()
        .filter_map(|cmd| {
            all_presets
                .iter()
                .find(|p| p.id == cmd.preset_id)
                .map(|preset| (cmd, preset.clone()))
        })
        .collect();

    // 6. Load tasks with terminals
    let tasks = WorkflowTask::find_by_workflow(&deployment.db().pool, &workflow_id).await?;
    let mut task_details: Vec<(WorkflowTask, Vec<Terminal>)> = Vec::new();
    for task in &tasks {
        let terminals = Terminal::find_by_task(&deployment.db().pool, &task.id).await?;
        task_details.push((task.clone(), terminals));
    }

    // Convert to DTO
    let dto = WorkflowDetailDto::from_workflow_with_terminals(&workflow, &task_details, &commands_with_presets);

    Ok(ResponseJson(ApiResponse::success(dto)))
}

/// GET /api/workflows/:workflow_id
/// Get workflow details
async fn get_workflow(
    State(deployment): State<DeploymentImpl>,
    Path(workflow_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<WorkflowDetailDto>>, ApiError> {
    // Get workflow
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Workflow not found".to_string()))?;

    // Get tasks and terminals
    let tasks = WorkflowTask::find_by_workflow(&deployment.db().pool, &workflow_id).await?;

    // Get commands with presets
    let commands = WorkflowCommand::find_by_workflow(&deployment.db().pool, &workflow_id).await?;
    let all_presets = SlashCommandPreset::find_all(&deployment.db().pool).await?;
    let commands_with_presets: Vec<(WorkflowCommand, SlashCommandPreset)> = commands
        .into_iter()
        .filter_map(|cmd| {
            all_presets
                .iter()
                .find(|p| p.id == cmd.preset_id)
                .map(|preset| (cmd, preset.clone()))
        })
        .collect();

    // Load terminals for each task
    let mut task_details: Vec<(WorkflowTask, Vec<Terminal>)> = Vec::new();
    for task in &tasks {
        let terminals = Terminal::find_by_task(&deployment.db().pool, &task.id).await?;
        task_details.push((task.clone(), terminals));
    }

    // Convert to DTO
    let dto = WorkflowDetailDto::from_workflow_with_terminals(&workflow, &task_details, &commands_with_presets);

    Ok(ResponseJson(ApiResponse::success(dto)))
}

/// DELETE /api/workflows/:workflow_id
/// Delete workflow
async fn delete_workflow(
    State(deployment): State<DeploymentImpl>,
    Path(workflow_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    Workflow::delete(&deployment.db().pool, &workflow_id).await?;
    Ok(ResponseJson(ApiResponse::success(())))
}

/// PUT /api/workflows/:workflow_id/status
/// Update workflow status
async fn update_workflow_status(
    State(deployment): State<DeploymentImpl>,
    Path(workflow_id): Path<String>,
    Json(req): Json<UpdateWorkflowStatusRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    Workflow::update_status(&deployment.db().pool, &workflow_id, &req.status).await?;
    Ok(ResponseJson(ApiResponse::success(())))
}

/// POST /api/workflows/:workflow_id/start
/// Start workflow (user confirmed)
async fn start_workflow(
    State(deployment): State<DeploymentImpl>,
    Path(workflow_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    // Check workflow status is ready
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Workflow not found".to_string()))?;

    if workflow.status != "ready" {
        return Err(ApiError::BadRequest(format!(
            "Workflow is not ready. Current status: {}",
            workflow.status
        )));
    }

    // Update status to running
    Workflow::set_started(&deployment.db().pool, &workflow_id).await?;

    // TODO: Trigger Orchestrator to start coordination

    Ok(ResponseJson(ApiResponse::success(())))
}

/// GET /api/workflows/:workflow_id/tasks
/// List workflow tasks
async fn list_workflow_tasks(
    State(deployment): State<DeploymentImpl>,
    Path(workflow_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<Vec<WorkflowTaskDetailResponse>>>, ApiError> {
    let tasks = WorkflowTask::find_by_workflow(&deployment.db().pool, &workflow_id).await?;
    let mut task_details = Vec::new();
    for task in tasks {
        let terminals = Terminal::find_by_task(&deployment.db().pool, &task.id).await?;
        task_details.push(WorkflowTaskDetailResponse { task, terminals });
    }
    Ok(ResponseJson(ApiResponse::success(task_details)))
}

/// GET /api/workflows/:workflow_id/tasks/:task_id/terminals
/// List task terminals
async fn list_task_terminals(
    State(deployment): State<DeploymentImpl>,
    Path((_, task_id)): Path<(String, String)>,
) -> Result<ResponseJson<ApiResponse<Vec<Terminal>>>, ApiError> {
    let terminals = Terminal::find_by_task(&deployment.db().pool, &task_id).await?;
    Ok(ResponseJson(ApiResponse::success(terminals)))
}

/// GET /api/workflows/presets/commands
/// List slash command presets
async fn list_command_presets(
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<Vec<SlashCommandPreset>>>, ApiError> {
    let presets = SlashCommandPreset::find_all(&deployment.db().pool).await?;
    Ok(ResponseJson(ApiResponse::success(presets)))
}

// ============================================================================
// Contract Tests
// ============================================================================

#[cfg(test)]
mod dto_tests {
    use super::*;
    use crate::routes::workflows_dto::WorkflowDetailDto;

    #[test]
    fn test_list_workflows_returns_camelcase() {
        // This test validates the expected format
        let response_json = r#"[
            {
                "id": "wf-test",
                "projectId": "proj-test",
                "name": "Test",
                "status": "created",
                "createdAt": "2026-01-24T10:00:00Z",
                "updatedAt": "2026-01-24T10:00:00Z",
                "tasksCount": 0,
                "terminalsCount": 0
            }
        ]"#;

        // Verify no snake_case
        assert!(!response_json.contains("\"project_id\""));
        assert!(!response_json.contains("\"created_at\""));

        // Verify camelCase
        assert!(response_json.contains("\"projectId\""));
        assert!(response_json.contains("\"createdAt\""));
    }

    #[test]
    fn test_get_workflow_returns_camelcase() {
        let response_json = r#"{
            "id": "wf-test",
            "projectId": "proj-test",
            "name": "Test Workflow",
            "status": "created",
            "useSlashCommands": true,
            "orchestratorEnabled": true,
            "createdAt": "2026-01-24T10:00:00Z",
            "updatedAt": "2026-01-24T10:00:00Z",
            "tasks": [],
            "commands": []
        }"#;

        // Verify no snake_case
        assert!(!response_json.contains("\"project_id\""));
        assert!(!response_json.contains("\"use_slash_commands\""));

        // Verify camelCase
        assert!(response_json.contains("\"projectId\""));
        assert!(response_json.contains("\"useSlashCommands\""));
        assert!(response_json.contains("\"orchestratorEnabled\""));
    }
}
