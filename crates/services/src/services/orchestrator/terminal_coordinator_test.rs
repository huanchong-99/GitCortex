//! Terminal Coordinator Tests
//!
//! Test terminal startup sequence with serial model switching.

use std::sync::Arc;
use uuid::Uuid;
use chrono::Utc;
use tokio::sync::Mutex;
use async_trait::async_trait;

use crate::services::cc_switch::CCSwitch;
use crate::services::orchestrator::TerminalCoordinator;
use db::{
    DBService,
    models::{
        terminal::Terminal,
        cli_type::{CliType, ModelConfig},
    },
};

// Helper function to create test database
async fn setup_test_db() -> DBService {
    let db = DBService::new().await.expect("Failed to create test DB");

    // Initialize schema
    sqlx::query(
        r"
        CREATE TABLE workflow (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL DEFAULT 'created',
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
            target_branch TEXT NOT NULL DEFAULT 'main',
            ready_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE workflow_task (
            id TEXT PRIMARY KEY,
            workflow_id TEXT NOT NULL,
            vk_task_id TEXT,
            name TEXT NOT NULL,
            description TEXT,
            branch TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            order_index INTEGER NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workflow_id) REFERENCES workflow(id)
        );

        CREATE TABLE cli_type (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            detect_command TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE model_config (
            id TEXT PRIMARY KEY,
            cli_type_id TEXT NOT NULL,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            api_model_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (cli_type_id) REFERENCES cli_type(id)
        );

        CREATE TABLE terminal (
            id TEXT PRIMARY KEY,
            workflow_task_id TEXT NOT NULL,
            cli_type_id TEXT NOT NULL,
            model_config_id TEXT NOT NULL,
            custom_base_url TEXT,
            custom_api_key TEXT,
            role TEXT,
            role_description TEXT,
            order_index INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'not_started',
            process_id INTEGER,
            pty_session_id TEXT,
            vk_session_id TEXT,
            last_commit_hash TEXT,
            last_commit_message TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (workflow_task_id) REFERENCES workflow_task(id),
            FOREIGN KEY (cli_type_id) REFERENCES cli_type(id),
            FOREIGN KEY (model_config_id) REFERENCES model_config(id)
        );
        "
    )
    .execute(&db.pool)
    .await
    .expect("Failed to create schema");

    db
}

// Helper function to create CLI type and model config
async fn create_cli_and_model(
    db: &DBService,
    cli_name: &str,
    model_name: &str,
) -> (CliType, ModelConfig) {
    let cli_id = Uuid::new_v4().to_string();
    let model_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    let cli = CliType {
        id: cli_id.clone(),
        name: cli_name.to_string(),
        display_name: format!("{} CLI", cli_name.to_uppercase()),
        detect_command: format!("which {}", cli_name),
        install_command: None,
        install_guide_url: None,
        config_file_path: None,
        is_system: false,
        created_at: now,
    };

    sqlx::query(
        r"
        INSERT INTO cli_type (id, name, display_name, detect_command, install_command, install_guide_url, config_file_path, is_system, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        "
    )
    .bind(&cli.id)
    .bind(&cli.name)
    .bind(&cli.display_name)
    .bind(&cli.detect_command)
    .bind(&cli.install_command)
    .bind(&cli.install_guide_url)
    .bind(&cli.config_file_path)
    .bind(&cli.is_system)
    .bind(cli.created_at)
    .execute(&db.pool)
    .await
    .expect("Failed to create CLI type");

    let model = ModelConfig {
        id: model_id.clone(),
        cli_type_id: cli_id,
        name: model_name.to_string(),
        display_name: format!("{} Model", model_name),
        api_model_id: Some(format!("{}-api-id", model_name)),
        is_default: true,
        is_official: true,
        created_at: now,
        updated_at: now,
    };

    sqlx::query(
        r"
        INSERT INTO model_config (id, cli_type_id, name, display_name, api_model_id, is_default, is_official, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        "
    )
    .bind(&model.id)
    .bind(&model.cli_type_id)
    .bind(&model.name)
    .bind(&model.display_name)
    .bind(&model.api_model_id)
    .bind(model.is_default)
    .bind(model.is_official)
    .bind(model.created_at)
    .bind(model.updated_at)
    .execute(&db.pool)
    .await
    .expect("Failed to create model config");

    (cli, model)
}

// Helper function to create workflow with tasks and terminals
async fn create_workflow_with_terminals(
    db: &DBService,
    num_tasks: usize,
    terminals_per_task: usize,
) -> (String, Vec<String>) {
    let workflow_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Create workflow
    sqlx::query(
        r"
        INSERT INTO workflow (
            id, project_id, name, description, status,
            use_slash_commands, orchestrator_enabled,
            orchestrator_api_type, orchestrator_base_url,
            orchestrator_api_key, orchestrator_model,
            error_terminal_enabled, error_terminal_cli_id, error_terminal_model_id,
            merge_terminal_cli_id, merge_terminal_model_id,
            target_branch, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
        "
    )
    .bind(&workflow_id)
    .bind("test-project")
    .bind("Test Workflow")
    .bind("Test Description")
    .bind("created")
    .bind(false)
    .bind(false)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind(false)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind("merge-cli")
    .bind("merge-model")
    .bind("main")
    .bind(now)
    .bind(now)
    .execute(&db.pool)
    .await
    .expect("Failed to create workflow");

    let mut terminal_ids = Vec::new();

    // Create tasks and terminals
    for task_idx in 0..num_tasks {
        let task_id = Uuid::new_v4().to_string();

        // Create task
        sqlx::query(
            r"
            INSERT INTO workflow_task (
                id, workflow_id, vk_task_id, name, description,
                branch, status, order_index, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "
        )
        .bind(&task_id)
        .bind(&workflow_id)
        .bind::<Option<String>>(None)
        .bind(format!("Task {}", task_idx))
        .bind(format!("Description for task {}", task_idx))
        .bind(format!("task-{}", task_idx))
        .bind("pending")
        .bind(task_idx as i32)
        .bind(now)
        .bind(now)
        .execute(&db.pool)
        .await
        .expect("Failed to create task");

        // Create terminals for this task
        for term_idx in 0..terminals_per_task {
            let terminal_id = Uuid::new_v4().to_string();
            let (cli, model) = create_cli_and_model(
                db,
                &format!("cli-{}", task_idx),
                &format!("model-{}", term_idx),
            ).await;

            sqlx::query(
                r"
                INSERT INTO terminal (
                    id, workflow_task_id, cli_type_id, model_config_id,
                    custom_base_url, custom_api_key, role, role_description,
                    order_index, status, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "
            )
            .bind(&terminal_id)
            .bind(&task_id)
            .bind(&cli.id)
            .bind(&model.id)
            .bind("https://api.test.com")
            .bind("test-api-key")
            .bind(format!("role-{}", term_idx))
            .bind(format!("Role description {}", term_idx))
            .bind(term_idx as i32)
            .bind("not_started")
            .bind(now)
            .bind(now)
            .execute(&db.pool)
            .await
            .expect("Failed to create terminal");

            terminal_ids.push(terminal_id);
        }
    }

    (workflow_id, terminal_ids)
}

// Mock CCSwitch implementation for testing
struct MockCCSwitch {
    switch_calls: Arc<Mutex<Vec<SwitchCall>>>,
}

#[derive(Debug, Clone)]
struct SwitchCall {
    terminal_id: String,
    cli_type_id: String,
    model_config_id: String,
}

#[async_trait]
impl CCSwitch for MockCCSwitch {
    async fn switch_for_terminal(
        &self,
        terminal: &Terminal,
    ) -> anyhow::Result<()> {
        let mut calls = self.switch_calls.lock().await;
        calls.push(SwitchCall {
            terminal_id: terminal.id.clone(),
            cli_type_id: terminal.cli_type_id.clone(),
            model_config_id: terminal.model_config_id.clone(),
        });
        Ok(())
    }
}

impl MockCCSwitch {
    fn new() -> Self {
        Self {
            switch_calls: Arc::new(Mutex::new(Vec::new())),
        }
    }

    async fn get_switch_calls(&self) -> Vec<SwitchCall> {
        self.switch_calls.lock().await.clone()
    }

    async fn call_count(&self) -> usize {
        self.switch_calls.lock().await.len()
    }
}

#[tokio::test]
async fn test_terminal_startup_sequence_succeeds() {
    let db = setup_test_db().await;
    let mock_cc_switch = Arc::new(MockCCSwitch::new());

    let coordinator = TerminalCoordinator::new(Arc::new(db.clone()), mock_cc_switch.clone());

    // Create workflow with 2 tasks, each with 2 terminals
    let (workflow_id, terminal_ids) = create_workflow_with_terminals(&db, 2, 2).await;

    // Start terminals for workflow
    let result: Result<(), anyhow::Error> = coordinator.start_terminals_for_workflow(&workflow_id).await;

    // Should succeed
    assert!(result.is_ok(), "Terminal startup should succeed with mock service");

    // Verify all terminals were switched
    assert_eq!(mock_cc_switch.call_count().await, 4, "Should switch 4 terminals");

    // Verify terminals are in "waiting" status
    for terminal_id in terminal_ids {
        let terminal = Terminal::find_by_id(&db.pool, &terminal_id)
            .await
            .expect("Failed to query terminal")
            .expect("Terminal not found");
        assert_eq!(terminal.status, "waiting", "Terminal should be in waiting status");
    }
}

#[tokio::test]
async fn test_terminal_startup_switches_models_serially() {
    let db = setup_test_db().await;
    let mock_cc_switch = Arc::new(MockCCSwitch::new());

    let coordinator = TerminalCoordinator::new(Arc::new(db.clone()), mock_cc_switch.clone());

    // Create workflow with 2 tasks, each with 2 terminals (4 terminals total)
    let (workflow_id, terminal_ids) = create_workflow_with_terminals(&db, 2, 2).await;

    // Start terminals for workflow
    let result: Result<(), anyhow::Error> = coordinator.start_terminals_for_workflow(&workflow_id).await;

    // Should succeed
    assert!(result.is_ok(), "Terminal startup should succeed");

    // Verify switches were called
    let calls = mock_cc_switch.get_switch_calls().await;
    assert_eq!(calls.len(), 4, "Should have 4 switch calls");

    // Verify switches were called in order (serial execution)
    for (i, terminal_id) in terminal_ids.iter().enumerate() {
        assert_eq!(
            &calls[i].terminal_id,
            terminal_id,
            "Switch call {} should be for terminal {}",
            i,
            terminal_id
        );
    }
}

#[tokio::test]
async fn test_empty_workflow_no_terminals() {
    let db = setup_test_db().await;
    let mock_cc_switch = Arc::new(MockCCSwitch::new());
    let coordinator = TerminalCoordinator::new(Arc::new(db.clone()), mock_cc_switch);

    // Create workflow with no tasks
    let workflow_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    sqlx::query(
        r"
        INSERT INTO workflow (
            id, project_id, name, description, status,
            use_slash_commands, orchestrator_enabled,
            orchestrator_api_type, orchestrator_base_url,
            orchestrator_api_key, orchestrator_model,
            error_terminal_enabled, error_terminal_cli_id, error_terminal_model_id,
            merge_terminal_cli_id, merge_terminal_model_id,
            target_branch, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
        "
    )
    .bind(&workflow_id)
    .bind("test-project")
    .bind("Test Workflow")
    .bind("Test Description")
    .bind("created")
    .bind(false)
    .bind(false)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind(false)
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind("merge-cli")
    .bind("merge-model")
    .bind("main")
    .bind(now)
    .bind(now)
    .execute(&db.pool)
    .await
    .expect("Failed to create workflow");

    // Should succeed with no terminals to start
    let result = coordinator.start_terminals_for_workflow(&workflow_id).await;
    assert!(result.is_ok(), "Should succeed with no terminals");
}

#[tokio::test]
async fn test_single_terminal_startup() {
    let db = setup_test_db().await;
    let mock_cc_switch = Arc::new(MockCCSwitch::new());

    let coordinator = TerminalCoordinator::new(Arc::new(db.clone()), mock_cc_switch.clone());

    // Create workflow with 1 task with 1 terminal
    let (workflow_id, terminal_ids) = create_workflow_with_terminals(&db, 1, 1).await;

    // Start terminals for workflow
    let result: Result<(), anyhow::Error> = coordinator.start_terminals_for_workflow(&workflow_id).await;

    // Should succeed
    assert!(result.is_ok(), "Single terminal startup should succeed");

    // Verify exactly one switch call
    assert_eq!(mock_cc_switch.call_count().await, 1, "Should switch 1 terminal");

    // Verify terminal is in "waiting" status
    let terminal = Terminal::find_by_id(&db.pool, &terminal_ids[0])
        .await
        .expect("Failed to query terminal")
        .expect("Terminal not found");
    assert_eq!(terminal.status, "waiting", "Terminal should be in waiting status");
}
