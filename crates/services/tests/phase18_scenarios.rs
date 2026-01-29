//! Phase 18 Scenario Tests
//!
//! Tests for concurrent workflows, failure handling, and recovery scenarios.

use std::str::FromStr;
use std::sync::Arc;

use chrono::Utc;
use db::models::{Terminal, Workflow, WorkflowTask};
use db::DBService;
use services::services::git_watcher::CommitMetadata;
use services::services::orchestrator::{MessageBus, OrchestratorRuntime, TerminalCompletionEvent, TerminalCompletionStatus, BusMessage};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use uuid::Uuid;

fn set_encryption_key() {
    unsafe {
        std::env::set_var(
            "GITCORTEX_ENCRYPTION_KEY",
            "12345678901234567890123456789012",
        );
    }
}

async fn setup_db() -> Arc<DBService> {
    let options = SqliteConnectOptions::from_str(":memory:")
        .unwrap()
        .pragma("foreign_keys", "OFF"); // Disable FK for easier test setup

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect_with(options)
        .await
        .unwrap();

    // Explicitly disable foreign keys
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&pool)
        .await
        .unwrap();

    let migrator = sqlx::migrate!("../db/migrations");
    migrator.run(&pool).await.unwrap();

    // Ensure foreign keys stay disabled after migrations
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&pool)
        .await
        .unwrap();

    Arc::new(DBService { pool })
}

async fn seed_project(db: &DBService) -> String {
    let project_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .bind(project_id)
    .bind("Phase18 Test Project")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&db.pool)
    .await
    .unwrap();
    project_id.to_string()
}

async fn create_ready_workflow(
    db: &DBService,
    project_id: &str,
) -> String {
    let workflow_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Use pre-seeded CLI type and model config from migrations
    let cli_type_id = "cli-claude-code";
    let model_config_id = "model-claude-sonnet";

    sqlx::query(
        r#"INSERT INTO workflow (
            id, project_id, name, status,
            orchestrator_enabled, orchestrator_api_type, orchestrator_base_url, orchestrator_model,
            merge_terminal_cli_id, merge_terminal_model_id, target_branch,
            ready_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&workflow_id)
    .bind(project_id)
    .bind("Phase18 Test Workflow")
    .bind("ready")
    .bind(true)
    .bind("openai-compatible")
    .bind("http://127.0.0.1:9999") // Fake URL for testing
    .bind("gpt-4")
    .bind(cli_type_id)
    .bind(model_config_id)
    .bind("main")
    .bind(now)
    .bind(now)
    .bind(now)
    .execute(&db.pool)
    .await
    .unwrap();

    workflow_id
}

async fn create_workflow_task(
    db: &DBService,
    workflow_id: &str,
    task_name: &str,
    order_index: i32,
) -> String {
    let task_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO workflow_task (
            id, workflow_id, name, branch, status, order_index, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&task_id)
    .bind(workflow_id)
    .bind(task_name)
    .bind(format!("workflow/{}/{}", workflow_id, task_name.to_lowercase().replace(' ', "-")))
    .bind("pending")
    .bind(order_index)
    .bind(now)
    .bind(now)
    .execute(&db.pool)
    .await
    .unwrap();

    task_id
}

async fn create_terminal(
    db: &DBService,
    task_id: &str,
    order_index: i32,
) -> String {
    let terminal_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Use pre-seeded CLI type and model config
    let cli_type_id = "cli-claude-code";
    let model_config_id = "model-claude-sonnet";

    let terminal = Terminal {
        id: terminal_id.clone(),
        workflow_task_id: task_id.to_string(),
        cli_type_id: cli_type_id.to_string(),
        model_config_id: model_config_id.to_string(),
        custom_base_url: None,
        custom_api_key: None,
        role: None,
        role_description: None,
        order_index,
        status: "not_started".to_string(),
        process_id: None,
        pty_session_id: None,
        session_id: None,
        execution_process_id: None,
        vk_session_id: None,
        last_commit_hash: None,
        last_commit_message: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    Terminal::create(&db.pool, &terminal).await.unwrap();
    terminal_id
}

// ============================================================================
// Task 18.1 Tests - Workflow Lifecycle
// ============================================================================

#[tokio::test]
async fn test_workflow_status_transition_created_to_ready() {
    set_encryption_key();
    let db = setup_db().await;
    let project_id = seed_project(&db).await;

    // Create workflow in 'created' status
    let workflow_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r#"INSERT INTO workflow (
            id, project_id, name, status,
            merge_terminal_cli_id, merge_terminal_model_id, target_branch,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&workflow_id)
    .bind(&project_id)
    .bind("Test Workflow")
    .bind("created")
    .bind("cli-claude-code")
    .bind("model-claude-sonnet")
    .bind("main")
    .bind(now)
    .bind(now)
    .execute(&db.pool)
    .await
    .unwrap();

    // Update to ready
    Workflow::update_status(&db.pool, &workflow_id, "ready").await.unwrap();

    // Verify
    let workflow = Workflow::find_by_id(&db.pool, &workflow_id).await.unwrap().unwrap();
    assert_eq!(workflow.status, "ready");
}

#[tokio::test]
async fn test_workflow_with_tasks_and_terminals() {
    set_encryption_key();
    let db = setup_db().await;
    let project_id = seed_project(&db).await;

    let workflow_id = create_ready_workflow(&db, &project_id).await;
    let task_id = create_workflow_task(&db, &workflow_id, "Task A", 0).await;
    let terminal_id = create_terminal(&db, &task_id, 0).await;

    // Verify workflow has tasks
    let tasks = WorkflowTask::find_by_workflow(&db.pool, &workflow_id).await.unwrap();
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].name, "Task A");

    // Verify task has terminals
    let terminals = Terminal::find_by_task(&db.pool, &task_id).await.unwrap();
    assert_eq!(terminals.len(), 1);
    assert_eq!(terminals[0].id, terminal_id);
}

#[tokio::test]
async fn test_commit_metadata_parsing() {
    let message = r#"Complete feature implementation

---METADATA---
workflow_id: wf-123
task_id: task-456
terminal_id: terminal-789
status: completed
next_action: continue"#;

    let metadata = CommitMetadata::parse(message).expect("Should parse metadata");

    assert_eq!(metadata.workflow_id, "wf-123");
    assert_eq!(metadata.task_id, "task-456");
    assert_eq!(metadata.terminal_id, "terminal-789");
    assert_eq!(metadata.status, "completed");
    assert_eq!(metadata.next_action, "continue");
}

#[tokio::test]
async fn test_commit_metadata_failed_status() {
    let message = r#"Fix authentication bug

---METADATA---
workflow_id: wf-123
task_id: task-456
terminal_id: terminal-789
status: failed
severity: error
next_action: retry"#;

    let metadata = CommitMetadata::parse(message).expect("Should parse metadata");

    assert_eq!(metadata.status, "failed");
    assert_eq!(metadata.severity, Some("error".to_string()));
    assert_eq!(metadata.next_action, "retry");
}

// ============================================================================
// Task 18.2 Tests - Concurrent/Failure/Recovery Scenarios
// ============================================================================

#[tokio::test]
async fn test_message_bus_terminal_completion_event() {
    let message_bus = MessageBus::new(100);
    let mut receiver = message_bus.subscribe_broadcast();

    let event = TerminalCompletionEvent {
        terminal_id: "terminal-123".to_string(),
        task_id: "task-456".to_string(),
        workflow_id: "wf-789".to_string(),
        status: TerminalCompletionStatus::Completed,
        commit_hash: Some("abc123".to_string()),
        commit_message: Some("Test commit".to_string()),
        metadata: None,
    };

    message_bus.publish_terminal_completed(event.clone()).await;

    // Receive the event
    let received: BusMessage = tokio::time::timeout(
        std::time::Duration::from_secs(1),
        receiver.recv(),
    )
    .await
    .expect("Should receive within timeout")
    .expect("Should receive message");

    match received {
        BusMessage::TerminalCompleted(e) => {
            assert_eq!(e.terminal_id, "terminal-123");
            assert_eq!(e.workflow_id, "wf-789");
        }
        _ => panic!("Expected TerminalCompleted message"),
    }
}

#[tokio::test]
async fn test_terminal_status_update_on_failure() {
    set_encryption_key();
    let db = setup_db().await;
    let project_id = seed_project(&db).await;

    let workflow_id = create_ready_workflow(&db, &project_id).await;
    let task_id = create_workflow_task(&db, &workflow_id, "Task A", 0).await;
    let terminal_id = create_terminal(&db, &task_id, 0).await;

    // Simulate terminal failure
    Terminal::set_completed(&db.pool, &terminal_id, "failed").await.unwrap();

    // Verify terminal status
    let terminal = Terminal::find_by_id(&db.pool, &terminal_id).await.unwrap().unwrap();
    assert_eq!(terminal.status, "failed");
    assert!(terminal.completed_at.is_some());
}

#[tokio::test]
async fn test_multiple_terminals_in_task() {
    set_encryption_key();
    let db = setup_db().await;
    let project_id = seed_project(&db).await;

    let workflow_id = create_ready_workflow(&db, &project_id).await;
    let task_id = create_workflow_task(&db, &workflow_id, "Multi-Terminal Task", 0).await;

    // Create 3 terminals
    let _terminal_ids: Vec<String> = futures::future::join_all(
        (0..3).map(|i| create_terminal(&db, &task_id, i))
    ).await;

    // Verify all terminals created
    let terminals = Terminal::find_by_task(&db.pool, &task_id).await.unwrap();
    assert_eq!(terminals.len(), 3);

    // Verify order
    for (i, terminal) in terminals.iter().enumerate() {
        assert_eq!(terminal.order_index, i as i32);
    }
}

#[tokio::test]
async fn test_workflow_task_status_transitions() {
    set_encryption_key();
    let db = setup_db().await;
    let project_id = seed_project(&db).await;

    let workflow_id = create_ready_workflow(&db, &project_id).await;
    let task_id = create_workflow_task(&db, &workflow_id, "Status Test Task", 0).await;

    // Initial status should be pending
    let task = WorkflowTask::find_by_id(&db.pool, &task_id).await.unwrap().unwrap();
    assert_eq!(task.status, "pending");

    // Update to running
    WorkflowTask::update_status(&db.pool, &task_id, "running").await.unwrap();
    let task = WorkflowTask::find_by_id(&db.pool, &task_id).await.unwrap().unwrap();
    assert_eq!(task.status, "running");

    // Update to completed
    WorkflowTask::update_status(&db.pool, &task_id, "completed").await.unwrap();
    let task = WorkflowTask::find_by_id(&db.pool, &task_id).await.unwrap().unwrap();
    assert_eq!(task.status, "completed");
}

#[tokio::test]
async fn test_orchestrator_runtime_creation() {
    set_encryption_key();
    let db = setup_db().await;
    let message_bus = Arc::new(MessageBus::new(1000));

    let runtime = OrchestratorRuntime::new(db.clone(), message_bus);

    // Runtime should be created successfully
    // No workflows should be running initially
    assert!(!runtime.is_running("non-existent-workflow").await);
}

#[tokio::test]
async fn test_workflow_find_by_project() {
    set_encryption_key();
    let db = setup_db().await;
    let project_id = seed_project(&db).await;

    // Create multiple workflows
    let _wf1 = create_ready_workflow(&db, &project_id).await;
    let _wf2 = create_ready_workflow(&db, &project_id).await;

    // Find workflows by project
    let workflows = Workflow::find_by_project(&db.pool, &project_id).await.unwrap();
    assert_eq!(workflows.len(), 2);
}

#[tokio::test]
async fn test_terminal_last_commit_update() {
    set_encryption_key();
    let db = setup_db().await;
    let project_id = seed_project(&db).await;

    let workflow_id = create_ready_workflow(&db, &project_id).await;
    let task_id = create_workflow_task(&db, &workflow_id, "Commit Test Task", 0).await;
    let terminal_id = create_terminal(&db, &task_id, 0).await;

    // Update last commit
    Terminal::update_last_commit(
        &db.pool,
        &terminal_id,
        "abc123def456",
        "feat: implement feature X",
    )
    .await
    .unwrap();

    // Verify
    let terminal = Terminal::find_by_id(&db.pool, &terminal_id).await.unwrap().unwrap();
    assert_eq!(terminal.last_commit_hash, Some("abc123def456".to_string()));
    assert_eq!(terminal.last_commit_message, Some("feat: implement feature X".to_string()));
}
