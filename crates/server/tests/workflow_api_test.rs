//! Integration tests for workflow API endpoints
//!
//! These tests verify the full workflow lifecycle including:
//! - Creating workflows
//! - Starting workflows
//! - Status transitions

use std::sync::Arc;

use db::models::{
    CliType, CreateTaskRequest, CreateTerminalRequest, CreateWorkflowRequest, MergeTerminalConfig,
    ModelConfig, OrchestratorConfig, Workflow,
};
use serde_json::json;
use server::{DeploymentImpl, routes::subscription_hub::SubscriptionHub};
use uuid::Uuid;

/// Helper: Create a test subscription hub
fn create_test_hub() -> server::routes::SharedSubscriptionHub {
    Arc::new(SubscriptionHub::default())
}

/// Helper: Setup test environment
async fn setup_test() -> (DeploymentImpl, String) {
    let deployment = DeploymentImpl::new()
        .await
        .expect("Failed to create deployment");

    // Create a test project
    let project_id = Uuid::new_v4().to_string();
    db::models::Project::create(
        &deployment.db().pool,
        &db::models::Project {
            id: project_id.clone(),
            name: "Test Project".to_string(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        },
    )
    .await
    .expect("Failed to create project");

    // Create CLI type
    let cli_type = CliType {
        id: "test-cli".to_string(),
        name: "Test CLI".to_string(),
        command: "echo".to_string(),
        args_template: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    CliType::create(&deployment.db().pool, &cli_type)
        .await
        .expect("Failed to create CLI type");

    // Create model config
    let model_config = ModelConfig {
        id: "test-model".to_string(),
        cli_type_id: "test-cli".to_string(),
        name: "Test Model".to_string(),
        api_base_url: None,
        api_key: None,
        model: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    ModelConfig::create(&deployment.db().pool, &model_config)
        .await
        .expect("Failed to create model config");

    (deployment, project_id)
}

/// Helper: Create a minimal workflow
async fn create_minimal_workflow(
    deployment: &DeploymentImpl,
    project_id: &str,
    orchestrator_enabled: bool,
) -> String {
    let workflow_id = Uuid::new_v4().to_string();

    let orchestrator_config = if orchestrator_enabled {
        Some(OrchestratorConfig {
            api_type: "openai-compatible".to_string(),
            base_url: "https://api.test.com".to_string(),
            api_key: "test-key".to_string(),
            model: "gpt-4".to_string(),
        })
    } else {
        None
    };

    let request = CreateWorkflowRequest {
        project_id: project_id.to_string(),
        name: "Test Workflow".to_string(),
        description: Some("Test description".to_string()),
        use_slash_commands: false,
        orchestrator_config,
        command_preset_ids: None,
        merge_terminal_config: MergeTerminalConfig {
            cli_type_id: "test-cli".to_string(),
            model_config_id: "test-model".to_string(),
        },
        error_terminal_config: None,
        target_branch: Some("main".to_string()),
        tasks: vec![],
    };

    // Create workflow directly in database
    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: project_id.to_string(),
        name: request.name,
        description: request.description,
        status: "created".to_string(),
        use_slash_commands: request.use_slash_commands,
        orchestrator_enabled: request.orchestrator_config.is_some(),
        orchestrator_api_type: request
            .orchestrator_config
            .as_ref()
            .map(|c| c.api_type.clone()),
        orchestrator_base_url: request
            .orchestrator_config
            .as_ref()
            .map(|c| c.base_url.clone()),
        orchestrator_api_key: request
            .orchestrator_config
            .as_ref()
            .map(|c| c.api_key.clone()),
        orchestrator_model: request
            .orchestrator_config
            .as_ref()
            .map(|c| c.model.clone()),
        error_terminal_enabled: request.error_terminal_config.is_some(),
        error_terminal_cli_id: request
            .error_terminal_config
            .as_ref()
            .map(|c| c.cli_type_id.clone()),
        error_terminal_model_id: request
            .error_terminal_config
            .as_ref()
            .map(|c| c.model_config_id.clone()),
        merge_terminal_cli_id: request.merge_terminal_config.cli_type_id,
        merge_terminal_model_id: request.merge_terminal_config.model_config_id,
        target_branch: "main".to_string(),
        ready_at: None,
        started_at: None,
        completed_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    Workflow::create(&deployment.db().pool, &workflow)
        .await
        .expect("Failed to create workflow");

    workflow_id
}

#[tokio::test]
async fn test_start_workflow_requires_ready_status() {
    // Setup: Create deployment and workflow in 'created' status
    let (deployment, project_id) = setup_test().await;
    let workflow_id = create_minimal_workflow(&deployment, &project_id, true).await;

    // Verify workflow is in 'created' status
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to query workflow")
        .expect("Workflow not found");
    assert_eq!(workflow.status, "created");

    // Attempt to start workflow - should return 500 Internal Server Error
    // (status validation now happens in runtime, which returns internal error)
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment.clone(), create_test_hub());

    let request = Request::builder()
        .method("POST")
        .uri(format!("/api/workflows/{}/start", workflow_id))
        .body(Body::empty())
        .expect("Failed to build request");

    let response = app.oneshot(request).await.expect("Failed to get response");

    // Should return 500 Internal Server Error (runtime validation failure)
    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

    // Verify workflow status is still 'created' (not changed)
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to query workflow")
        .expect("Workflow not found");
    assert_eq!(workflow.status, "created");
}

#[tokio::test]
async fn test_start_workflow_transitions_to_running() {
    // Setup: Create deployment and workflow in 'ready' status
    let (deployment, project_id) = setup_test().await;
    let workflow_id = create_minimal_workflow(&deployment, &project_id, true).await;

    // Set workflow status to 'ready'
    Workflow::update_status(&deployment.db().pool, &workflow_id, "ready")
        .await
        .expect("Failed to update workflow status to ready");

    // Verify workflow is in 'ready' status
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to query workflow")
        .expect("Workflow not found");
    assert_eq!(workflow.status, "ready");
    assert!(workflow.started_at.is_none());

    // Start workflow via API
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment.clone(), create_test_hub());

    let request = Request::builder()
        .method("POST")
        .uri(format!("/api/workflows/{}/start", workflow_id))
        .body(Body::empty())
        .expect("Failed to build request");

    let response = app.oneshot(request).await.expect("Failed to get response");

    // Should return 200 OK
    assert_eq!(response.status(), StatusCode::OK);

    // Verify workflow status is now 'running'
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to query workflow")
        .expect("Workflow not found");
    assert_eq!(workflow.status, "running");
    assert!(
        workflow.started_at.is_some(),
        "started_at should be set after starting workflow"
    );
}

#[tokio::test]
async fn test_start_workflow_requires_orchestrator_enabled() {
    // Setup: Create workflow with orchestrator_enabled = false
    let (deployment, project_id) = setup_test().await;
    let workflow_id = create_minimal_workflow(&deployment, &project_id, false).await;

    // Set workflow status to 'ready'
    Workflow::update_status(&deployment.db().pool, &workflow_id, "ready")
        .await
        .expect("Failed to update workflow status to ready");

    // Verify workflow is ready but orchestrator is disabled
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to query workflow")
        .expect("Workflow not found");
    assert_eq!(workflow.status, "ready");
    assert!(!workflow.orchestrator_enabled);

    // Attempt to start workflow - should return 400 BadRequest
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment.clone(), create_test_hub());

    let request = Request::builder()
        .method("POST")
        .uri(format!("/api/workflows/{}/start", workflow_id))
        .body(Body::empty())
        .expect("Failed to build request");

    let response = app.oneshot(request).await.expect("Failed to get response");

    // Should return 400 BadRequest
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Verify workflow status is still 'ready' (not changed)
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to query workflow")
        .expect("Workflow not found");
    assert_eq!(workflow.status, "ready");
}
