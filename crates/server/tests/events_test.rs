//! Integration tests for event broadcasting
//!
//! These tests verify that status updates (workflow, task, terminal)
//! are properly broadcast through the MessageBus for real-time client updates.

use server::DeploymentImpl;
use db::models::{
    CreateWorkflowRequest, CreateTaskRequest, CreateTerminalRequest,
    MergeTerminalConfig, OrchestratorConfig, Workflow, CliType, ModelConfig,
};
use uuid::Uuid;
use std::time::Duration;
use tokio::time::timeout;

/// Helper: Setup test environment
async fn setup_test() -> (DeploymentImpl, String) {
    let deployment = DeploymentImpl::new().await
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
    ).await.expect("Failed to create project");

    // Create CLI type
    let cli_type = CliType {
        id: "test-cli".to_string(),
        name: "Test CLI".to_string(),
        command: "echo".to_string(),
        args_template: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    CliType::create(&deployment.db().pool, &cli_type).await
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
    ModelConfig::create(&deployment.db().pool, &model_config).await
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
        status: "ready".to_string(),
        use_slash_commands: request.use_slash_commands,
        orchestrator_enabled: request.orchestrator_config.is_some(),
        orchestrator_api_type: request.orchestrator_config.as_ref().map(|c| c.api_type.clone()),
        orchestrator_base_url: request.orchestrator_config.as_ref().map(|c| c.base_url.clone()),
        orchestrator_api_key: request.orchestrator_config.as_ref().map(|c| c.api_key.clone()),
        orchestrator_model: request.orchestrator_config.as_ref().map(|c| c.model.clone()),
        error_terminal_enabled: request.error_terminal_config.is_some(),
        error_terminal_cli_id: request.error_terminal_config.as_ref().map(|c| c.cli_type_id.clone()),
        error_terminal_model_id: request.error_terminal_config.as_ref().map(|c| c.model_config_id.clone()),
        merge_terminal_cli_id: request.merge_terminal_config.cli_type_id,
        merge_terminal_model_id: request.merge_terminal_config.model_config_id,
        target_branch: "main".to_string(),
        ready_at: Some(chrono::Utc::now()),
        started_at: None,
        completed_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    Workflow::create(&deployment.db().pool, &workflow).await
        .expect("Failed to create workflow");

    workflow_id
}

#[tokio::test]
async fn test_workflow_status_broadcast() {
    // Setup: Create deployment and workflow
    let (deployment, project_id) = setup_test().await;
    let workflow_id = create_minimal_workflow(&deployment, &project_id, true).await;

    // Get the orchestrator runtime
    let runtime = deployment.orchestrator_runtime();
    let message_bus = runtime.message_bus();

    // Subscribe to workflow events
    let topic = format!("workflow:{}", workflow_id);
    let mut subscriber = message_bus.subscribe(&topic).await;

    // Broadcast workflow status update
    use services::orchestrator::agent::OrchestratorAgent;
    use services::orchestrator::config::OrchestratorConfig as AgentConfig;

    let config = AgentConfig {
        api_type: "openai-compatible".to_string(),
        base_url: "https://api.test.com".to_string(),
        api_key: "test-key".to_string(),
        model: "gpt-4".to_string(),
        system_prompt: "Test system prompt".to_string(),
        max_conversation_history: 50,
        timeout_secs: 120,
        max_retries: 3,
        retry_delay_ms: 1000,
        rate_limit_per_second: 10,
    };

    let agent = OrchestratorAgent::new(
        config,
        workflow_id.clone(),
        message_bus.clone(),
        deployment.db(),
    ).expect("Failed to create agent");

    // Broadcast workflow status
    agent.broadcast_workflow_status("running").await.expect("Failed to broadcast workflow status");

    // Verify the status update was received
    let message = timeout(Duration::from_millis(500), subscriber.recv())
        .await
        .expect("Timeout waiting for status update")
        .expect("No message received");

    match message {
        services::orchestrator::message_bus::BusMessage::StatusUpdate { workflow_id: received_id, status } => {
            assert_eq!(received_id, workflow_id);
            assert_eq!(status, "running");
        }
        _ => panic!("Expected StatusUpdate message, got {:?}", message),
    }

    // Verify database was updated
    let workflow = Workflow::find_by_id(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to query workflow")
        .expect("Workflow not found");
    assert_eq!(workflow.status, "running");
}

#[tokio::test]
async fn test_terminal_status_broadcast() {
    // Setup: Create deployment, workflow, and task
    let (deployment, project_id) = setup_test().await;
    let workflow_id = create_minimal_workflow(&deployment, &project_id, true).await;

    // Create a workflow task
    let task_id = Uuid::new_v4().to_string();
    let task = db::models::WorkflowTask {
        id: task_id.clone(),
        workflow_id: workflow_id.clone(),
        vk_task_id: None,
        name: "Test Task".to_string(),
        description: None,
        branch: "test-branch".to_string(),
        status: "pending".to_string(),
        order_index: 0,
        started_at: None,
        completed_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    db::models::WorkflowTask::create(&deployment.db().pool, &task).await
        .expect("Failed to create task");

    // Create a terminal
    let terminal_id = Uuid::new_v4().to_string();
    let terminal = db::models::Terminal {
        id: terminal_id.clone(),
        workflow_task_id: task_id.clone(),
        cli_type_id: "test-cli".to_string(),
        model_config_id: "test-model".to_string(),
        custom_base_url: None,
        custom_api_key: None,
        role: Some("coder".to_string()),
        role_description: None,
        order_index: 0,
        status: "pending".to_string(),
        process_id: None,
        pty_session_id: None,
        vk_session_id: None,
        last_commit_hash: None,
        last_commit_message: None,
        started_at: None,
        completed_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    db::models::Terminal::create(&deployment.db().pool, &terminal).await
        .expect("Failed to create terminal");

    // Get the orchestrator runtime
    let runtime = deployment.orchestrator_runtime();
    let message_bus = runtime.message_bus();

    // Subscribe to workflow events
    let topic = format!("workflow:{}", workflow_id);
    let mut subscriber = message_bus.subscribe(&topic).await;

    // Create agent and broadcast terminal status
    use services::orchestrator::agent::OrchestratorAgent;
    use services::orchestrator::config::OrchestratorConfig as AgentConfig;

    let config = AgentConfig {
        api_type: "openai-compatible".to_string(),
        base_url: "https://api.test.com".to_string(),
        api_key: "test-key".to_string(),
        model: "gpt-4".to_string(),
        system_prompt: "Test system prompt".to_string(),
        max_conversation_history: 50,
        timeout_secs: 120,
        max_retries: 3,
        retry_delay_ms: 1000,
        rate_limit_per_second: 10,
    };

    let agent = OrchestratorAgent::new(
        config,
        workflow_id.clone(),
        message_bus.clone(),
        deployment.db(),
    ).expect("Failed to create agent");

    // Broadcast terminal status
    agent.broadcast_terminal_status(&terminal_id, "running").await
        .expect("Failed to broadcast terminal status");

    // Verify the status update was received
    let message = timeout(Duration::from_millis(500), subscriber.recv())
        .await
        .expect("Timeout waiting for status update")
        .expect("No message received");

    match message {
        services::orchestrator::message_bus::BusMessage::TerminalStatusUpdate {
            workflow_id: received_id,
            terminal_id: received_terminal_id,
            status
        } => {
            assert_eq!(received_id, workflow_id);
            assert_eq!(received_terminal_id, terminal_id);
            assert_eq!(status, "running");
        }
        _ => panic!("Expected TerminalStatusUpdate message, got {:?}", message),
    }

    // Verify database was updated
    let terminal = db::models::Terminal::find_by_id(&deployment.db().pool, &terminal_id)
        .await
        .expect("Failed to query terminal")
        .expect("Terminal not found");
    assert_eq!(terminal.status, "running");
}

#[tokio::test]
async fn test_task_status_broadcast() {
    // Setup: Create deployment, workflow, and task
    let (deployment, project_id) = setup_test().await;
    let workflow_id = create_minimal_workflow(&deployment, &project_id, true).await;

    // Create a workflow task
    let task_id = Uuid::new_v4().to_string();
    let task = db::models::WorkflowTask {
        id: task_id.clone(),
        workflow_id: workflow_id.clone(),
        vk_task_id: None,
        name: "Test Task".to_string(),
        description: None,
        branch: "test-branch".to_string(),
        status: "pending".to_string(),
        order_index: 0,
        started_at: None,
        completed_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };
    db::models::WorkflowTask::create(&deployment.db().pool, &task).await
        .expect("Failed to create task");

    // Get the orchestrator runtime
    let runtime = deployment.orchestrator_runtime();
    let message_bus = runtime.message_bus();

    // Subscribe to workflow events
    let topic = format!("workflow:{}", workflow_id);
    let mut subscriber = message_bus.subscribe(&topic).await;

    // Create agent and broadcast task status
    use services::orchestrator::agent::OrchestratorAgent;
    use services::orchestrator::config::OrchestratorConfig as AgentConfig;

    let config = AgentConfig {
        api_type: "openai-compatible".to_string(),
        base_url: "https://api.test.com".to_string(),
        api_key: "test-key".to_string(),
        model: "gpt-4".to_string(),
        system_prompt: "Test system prompt".to_string(),
        max_conversation_history: 50,
        timeout_secs: 120,
        max_retries: 3,
        retry_delay_ms: 1000,
        rate_limit_per_second: 10,
    };

    let agent = OrchestratorAgent::new(
        config,
        workflow_id.clone(),
        message_bus.clone(),
        deployment.db(),
    ).expect("Failed to create agent");

    // Broadcast task status
    agent.broadcast_task_status(&task_id, "running").await
        .expect("Failed to broadcast task status");

    // Verify the status update was received
    let message = timeout(Duration::from_millis(500), subscriber.recv())
        .await
        .expect("Timeout waiting for status update")
        .expect("No message received");

    match message {
        services::orchestrator::message_bus::BusMessage::TaskStatusUpdate {
            workflow_id: received_id,
            task_id: received_task_id,
            status
        } => {
            assert_eq!(received_id, workflow_id);
            assert_eq!(received_task_id, task_id);
            assert_eq!(status, "running");
        }
        _ => panic!("Expected TaskStatusUpdate message, got {:?}", message),
    }

    // Verify database was updated
    let task = db::models::WorkflowTask::find_by_id(&deployment.db().pool, &task_id)
        .await
        .expect("Failed to query task")
        .expect("Task not found");
    assert_eq!(task.status, "running");
}
