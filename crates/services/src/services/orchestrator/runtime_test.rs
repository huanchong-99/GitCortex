//! Orchestrator Runtime Tests

use super::runtime::{OrchestratorRuntime, RuntimeConfig};
use db::DBService;
use db::models::{Workflow, WorkflowTask, Terminal, CreateWorkflowTaskRequest, CreateTerminalRequest};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;
use chrono::Utc;

#[tokio::test]
async fn test_runtime_starts_and_stops_workflow() {
    // Setup in-memory database
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    sqlx::query(r"
        CREATE TABLE workflow (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            use_slash_commands INTEGER NOT NULL DEFAULT 0,
            orchestrator_enabled INTEGER NOT NULL DEFAULT 0,
            orchestrator_api_type TEXT,
            orchestrator_base_url TEXT,
            orchestrator_api_key TEXT,
            orchestrator_model TEXT,
            error_terminal_enabled INTEGER NOT NULL DEFAULT 0,
            error_terminal_cli_id TEXT,
            error_terminal_model_id TEXT,
            merge_terminal_cli_id TEXT NOT NULL,
            merge_terminal_model_id TEXT NOT NULL,
            target_branch TEXT NOT NULL,
            ready_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ").execute(&pool).await.unwrap();

    let db = Arc::new(DBService::new(pool.clone()));
    let message_bus = Arc::new(super::MessageBus::new(1000));

    let runtime = OrchestratorRuntime::new(db.clone(), message_bus);

    // Create a ready workflow
    let workflow_id = Uuid::new_v4().to_string();
    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: Uuid::new_v4().to_string(),
        name: "Test Workflow".to_string(),
        description: None,
        status: "ready".to_string(),
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
        ready_at: Some(Utc::now()),
        started_at: None,
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Workflow::create(&pool, &workflow).await.unwrap();

    // Start workflow
    let result = runtime.start_workflow(&workflow_id).await;
    assert!(result.is_ok(), "Should start workflow successfully: {:?}", result.err());

    // Verify workflow is running
    assert!(runtime.is_running(&workflow_id).await, "Workflow should be running");
    assert_eq!(runtime.running_count().await, 1, "Should have 1 running workflow");

    // Stop workflow
    let result = runtime.stop_workflow(&workflow_id).await;
    assert!(result.is_ok(), "Should stop workflow successfully: {:?}", result.err());

    // Verify workflow is stopped
    assert!(!runtime.is_running(&workflow_id).await, "Workflow should not be running");
    assert_eq!(runtime.running_count().await, 0, "Should have 0 running workflows");
}

#[tokio::test]
async fn test_runtime_prevents_duplicate_start() {
    // Setup in-memory database
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    sqlx::query(r"
        CREATE TABLE workflow (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            use_slash_commands INTEGER NOT NULL DEFAULT 0,
            orchestrator_enabled INTEGER NOT NULL DEFAULT 0,
            orchestrator_api_type TEXT,
            orchestrator_base_url TEXT,
            orchestrator_api_key TEXT,
            orchestrator_model TEXT,
            error_terminal_enabled INTEGER NOT NULL DEFAULT 0,
            error_terminal_cli_id TEXT,
            error_terminal_model_id TEXT,
            merge_terminal_cli_id TEXT NOT NULL,
            merge_terminal_model_id TEXT NOT NULL,
            target_branch TEXT NOT NULL,
            ready_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ").execute(&pool).await.unwrap();

    let db = Arc::new(DBService::new(pool.clone()));
    let message_bus = Arc::new(super::MessageBus::new(1000));

    let runtime = OrchestratorRuntime::new(db.clone(), message_bus);

    // Create a ready workflow
    let workflow_id = Uuid::new_v4().to_string();
    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: Uuid::new_v4().to_string(),
        name: "Test Workflow".to_string(),
        description: None,
        status: "ready".to_string(),
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
        ready_at: Some(Utc::now()),
        started_at: None,
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Workflow::create(&pool, &workflow).await.unwrap();

    // First start should succeed
    assert!(runtime.start_workflow(&workflow_id).await.is_ok(), "First start should succeed");

    // Second start should fail
    let result = runtime.start_workflow(&workflow_id).await;
    assert!(result.is_err(), "Should not allow duplicate start");
    assert!(result.unwrap_err().to_string().contains("already running"),
            "Error message should mention 'already running'");
}

#[tokio::test]
async fn test_runtime_validates_workflow_state() {
    // Setup in-memory database
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    sqlx::query(r"
        CREATE TABLE workflow (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            use_slash_commands INTEGER NOT NULL DEFAULT 0,
            orchestrator_enabled INTEGER NOT NULL DEFAULT 0,
            orchestrator_api_type TEXT,
            orchestrator_base_url TEXT,
            orchestrator_api_key TEXT,
            orchestrator_model TEXT,
            error_terminal_enabled INTEGER NOT NULL DEFAULT 0,
            error_terminal_cli_id TEXT,
            error_terminal_model_id TEXT,
            merge_terminal_cli_id TEXT NOT NULL,
            merge_terminal_model_id TEXT NOT NULL,
            target_branch TEXT NOT NULL,
            ready_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ").execute(&pool).await.unwrap();

    let db = Arc::new(DBService::new(pool.clone()));
    let message_bus = Arc::new(super::MessageBus::new(1000));

    let runtime = OrchestratorRuntime::new(db.clone(), message_bus);

    // Create a workflow in 'created' state (not ready)
    let workflow_id = Uuid::new_v4().to_string();
    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: Uuid::new_v4().to_string(),
        name: "Test Workflow".to_string(),
        description: None,
        status: "created".to_string(),
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
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Workflow::create(&pool, &workflow).await.unwrap();

    // Should fail to start workflow not in ready state
    let result = runtime.start_workflow(&workflow_id).await;
    assert!(result.is_err(), "Should not start workflow in 'created' state");
    assert!(result.unwrap_err().to_string().contains("not ready"),
            "Error message should mention 'not ready'");
}

#[tokio::test]
async fn test_runtime_handles_nonexistent_workflow() {
    // Setup in-memory database
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    let db = Arc::new(DBService::new(pool));
    let message_bus = Arc::new(super::MessageBus::new(1000));

    let runtime = OrchestratorRuntime::new(db.clone(), message_bus);

    // Try to start nonexistent workflow
    let workflow_id = Uuid::new_v4().to_string();
    let result = runtime.start_workflow(&workflow_id).await;

    assert!(result.is_err(), "Should fail for nonexistent workflow");
    assert!(result.unwrap_err().to_string().contains("not found"),
            "Error message should mention 'not found'");
}

#[tokio::test]
async fn test_runtime_recovers_running_workflows() {
    // Setup in-memory database
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    sqlx::query(r"
        CREATE TABLE workflow (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            use_slash_commands INTEGER NOT NULL DEFAULT 0,
            orchestrator_enabled INTEGER NOT NULL DEFAULT 0,
            orchestrator_api_type TEXT,
            orchestrator_base_url TEXT,
            orchestrator_api_key TEXT,
            orchestrator_model TEXT,
            error_terminal_enabled INTEGER NOT NULL DEFAULT 0,
            error_terminal_cli_id TEXT,
            error_terminal_model_id TEXT,
            merge_terminal_cli_id TEXT NOT NULL,
            merge_terminal_model_id TEXT NOT NULL,
            target_branch TEXT NOT NULL,
            ready_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ").execute(&pool).await.unwrap();

    let db = Arc::new(DBService::new(pool.clone()));
    let message_bus = Arc::new(super::MessageBus::new(1000));

    // Create a workflow in 'running' state (simulating crash)
    let workflow_id = Uuid::new_v4().to_string();
    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: Uuid::new_v4().to_string(),
        name: "Test Workflow".to_string(),
        description: None,
        status: "running".to_string(),
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
        ready_at: Some(Utc::now()),
        started_at: Some(Utc::now()),
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Workflow::create(&pool, &workflow).await.unwrap();

    let runtime = OrchestratorRuntime::new(db.clone(), message_bus);

    // Recover running workflows
    let result = runtime.recover_running_workflows().await;
    assert!(result.is_ok(), "Recovery should succeed");

    // Verify workflow was marked as failed
    let updated_workflow = Workflow::find_by_id(&pool, &workflow_id).await.unwrap();
    assert!(updated_workflow.is_some(), "Workflow should still exist");
    assert_eq!(updated_workflow.unwrap().status, "failed",
               "Workflow should be marked as 'failed' after recovery");
}

#[tokio::test]
async fn test_runtime_stop_all() {
    // Setup in-memory database
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    sqlx::query(r"
        CREATE TABLE workflow (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            use_slash_commands INTEGER NOT NULL DEFAULT 0,
            orchestrator_enabled INTEGER NOT NULL DEFAULT 0,
            orchestrator_api_type TEXT,
            orchestrator_base_url TEXT,
            orchestrator_api_key TEXT,
            orchestrator_model TEXT,
            error_terminal_enabled INTEGER NOT NULL DEFAULT 0,
            error_terminal_cli_id TEXT,
            error_terminal_model_id TEXT,
            merge_terminal_cli_id TEXT NOT NULL,
            merge_terminal_model_id TEXT NOT NULL,
            target_branch TEXT NOT NULL,
            ready_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ").execute(&pool).await.unwrap();

    let db = Arc::new(DBService::new(pool.clone()));
    let message_bus = Arc::new(super::MessageBus::new(1000));

    let runtime = OrchestratorRuntime::new(db.clone(), message_bus.clone());

    // Create multiple ready workflows
    let workflow_ids: Vec<String> = (0..3).map(|_| {
        let id = Uuid::new_v4().to_string();
        let workflow = Workflow {
            id: id.clone(),
            project_id: Uuid::new_v4().to_string(),
            name: format!("Test Workflow {}", id),
            description: None,
            status: "ready".to_string(),
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
            ready_at: Some(Utc::now()),
            started_at: None,
            completed_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        Workflow::create(&pool, &workflow).await.unwrap();
        id
    }).collect();

    // Start all workflows
    for workflow_id in &workflow_ids {
        runtime.start_workflow(workflow_id).await.unwrap();
    }

    assert_eq!(runtime.running_count().await, 3, "Should have 3 running workflows");

    // Stop all workflows
    let result = runtime.stop_all().await;
    assert!(result.is_ok(), "stop_all should succeed");

    // Verify all workflows are stopped
    assert_eq!(runtime.running_count().await, 0, "Should have 0 running workflows");
    for workflow_id in &workflow_ids {
        assert!(!runtime.is_running(workflow_id).await,
                "Workflow {} should not be running", workflow_id);
    }
}

#[tokio::test]
async fn test_runtime_enforces_concurrent_limit() {
    // Setup in-memory database
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    sqlx::query(r"
        CREATE TABLE workflow (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            use_slash_commands INTEGER NOT NULL DEFAULT 0,
            orchestrator_enabled INTEGER NOT NULL DEFAULT 0,
            orchestrator_api_type TEXT,
            orchestrator_base_url TEXT,
            orchestrator_api_key TEXT,
            orchestrator_model TEXT,
            error_terminal_enabled INTEGER NOT NULL DEFAULT 0,
            error_terminal_cli_id TEXT,
            error_terminal_model_id TEXT,
            merge_terminal_cli_id TEXT NOT NULL,
            merge_terminal_model_id TEXT NOT NULL,
            target_branch TEXT NOT NULL,
            ready_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ").execute(&pool).await.unwrap();

    let db = Arc::new(DBService::new(pool.clone()));
    let message_bus = Arc::new(super::MessageBus::new(1000));

    // Create runtime with limit of 2 concurrent workflows
    let config = RuntimeConfig {
        max_concurrent_workflows: 2,
        message_bus_capacity: 1000,
    };
    let runtime = OrchestratorRuntime::with_config(db.clone(), message_bus, config);

    // Create 3 ready workflows
    let workflow_ids: Vec<String> = (0..3).map(|_| {
        let id = Uuid::new_v4().to_string();
        let workflow = Workflow {
            id: id.clone(),
            project_id: Uuid::new_v4().to_string(),
            name: format!("Test Workflow {}", id),
            description: None,
            status: "ready".to_string(),
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
            ready_at: Some(Utc::now()),
            started_at: None,
            completed_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        Workflow::create(&pool, &workflow).await.unwrap();
        id
    }).collect();

    // Start first workflow - should succeed
    assert!(runtime.start_workflow(&workflow_ids[0]).await.is_ok(),
            "First workflow should start");

    // Start second workflow - should succeed
    assert!(runtime.start_workflow(&workflow_ids[1]).await.is_ok(),
            "Second workflow should start");

    // Start third workflow - should fail due to limit
    let result = runtime.start_workflow(&workflow_ids[2]).await;
    assert!(result.is_err(), "Third workflow should fail due to concurrent limit");
    assert!(result.unwrap_err().to_string().contains("Maximum concurrent workflows limit reached"),
            "Error should mention concurrent limit");

    // Verify only 2 workflows are running
    assert_eq!(runtime.running_count().await, 2, "Should have 2 running workflows");
}
