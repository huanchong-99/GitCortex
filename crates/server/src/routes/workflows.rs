//! Workflow API Routes

use axum::{
    extract::{Path, Query, State},
    routing::{get, post, put},
    Json, Router,
    response::Json as ResponseJson,
};
use db::models::{
    Workflow, WorkflowTask, Terminal, SlashCommandPreset, WorkflowCommand,
    CreateWorkflowRequest,
};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;
use crate::{error::ApiError, DeploymentImpl};
use utils::response::ApiResponse;

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
        .route("/:workflow_id/tasks/:task_id/terminals", get(list_task_terminals))
        .route("/presets/commands", get(list_command_presets))
}

// ============================================================================
// Route Handlers
// ============================================================================

/// GET /api/workflows?project_id=xxx
/// List workflows for a project
async fn list_workflows(
    State(deployment): State<DeploymentImpl>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<ResponseJson<ApiResponse<Vec<Workflow>>>, ApiError> {
    let project_id = params
        .get("project_id")
        .ok_or_else(|| ApiError::BadRequest("project_id is required".to_string()))?;

    let workflows = Workflow::find_by_project(&deployment.db().pool, project_id).await?;
    Ok(ResponseJson(ApiResponse::success(workflows)))
}

/// POST /api/workflows
/// Create workflow
async fn create_workflow(
    State(deployment): State<DeploymentImpl>,
    Json(req): Json<CreateWorkflowRequest>,
) -> Result<ResponseJson<ApiResponse<WorkflowDetailResponse>>, ApiError> {
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
            let index = i32::try_from(index).map_err(|_| {
                ApiError::BadRequest("Command preset index overflow".to_string())
            })?;
            let preset_id: &str = preset_id;
            WorkflowCommand::create(
                &deployment.db().pool,
                &workflow_id,
                preset_id,
                index,
                None,
            ).await?;
        }
        commands = WorkflowCommand::find_by_workflow(&deployment.db().pool, &workflow_id).await?;
    }

    // 3. Create tasks and terminals (simplified for now)
    let task_details: Vec<WorkflowTaskDetailResponse> = Vec::new();

    // 4. Get command preset details
    let all_presets = SlashCommandPreset::find_all(&deployment.db().pool).await?;
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

    Ok(ResponseJson(ApiResponse::success(WorkflowDetailResponse {
        workflow,
        tasks: task_details,
        commands: commands_with_presets,
    })))
}

/// GET /api/workflows/:workflow_id
/// Get workflow details
async fn get_workflow(
    State(deployment): State<DeploymentImpl>,
    Path(workflow_id): Path<String>,
) -> Result<ResponseJson<ApiResponse<WorkflowDetailResponse>>, ApiError> {
    // Get workflow
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await?
        .ok_or_else(|| ApiError::BadRequest("Workflow not found".to_string()))?;

    // Get tasks and terminals
    let tasks = WorkflowTask::find_by_workflow(&deployment.db().pool, &workflow_id).await?;
    let mut task_details = Vec::new();
    for task in tasks {
        let terminals = Terminal::find_by_task(&deployment.db().pool, &task.id).await?;
        task_details.push(WorkflowTaskDetailResponse {
            task,
            terminals,
        });
    }

    // Get commands
    let commands = WorkflowCommand::find_by_workflow(&deployment.db().pool, &workflow_id).await?;
    let all_presets = SlashCommandPreset::find_all(&deployment.db().pool).await?;
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

    Ok(ResponseJson(ApiResponse::success(WorkflowDetailResponse {
        workflow,
        tasks: task_details,
        commands: commands_with_presets,
    })))
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
        return Err(ApiError::BadRequest(
            format!("Workflow is not ready. Current status: {}", workflow.status)
        ));
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
        task_details.push(WorkflowTaskDetailResponse {
            task,
            terminals,
        });
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
