use services::services::terminal::TerminalLauncher;
use db::{DBService, models::Terminal, models::session::Session, models::execution_process::ExecutionProcess};
use uuid::Uuid;
use chrono::Utc;
use std::sync::Arc;

#[tokio::test]
async fn test_terminal_launch_creates_session() {
    // Setup: Create in-memory DB and launcher
    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    // Run migrations
    let migrations_path = std::path::PathBuf::from("../../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    let db = Arc::new(DBService { pool: pool.clone() });
    let cc_switch = Arc::new(services::services::cc_switch::CCSwitchService::new(Arc::clone(&db)));
    let process_manager = Arc::new(services::services::terminal::ProcessManager::new());
    let working_dir = std::env::temp_dir();
    let launcher = TerminalLauncher::new(Arc::clone(&db), cc_switch, process_manager, working_dir);

    // Create test project, task, workspace
    let project_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO project (id, name, base_dir, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(project_id)
    .bind("test-project")
    .bind("/tmp")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let task_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO task (id, project_id, user_prompt, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(task_id)
    .bind(project_id)
    .bind("test prompt")
    .bind("created")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let workspace_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO workspace (id, task_id, branch, created_at, updated_at, archived, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(workspace_id)
    .bind(task_id)
    .bind("main")
    .bind(Utc::now())
    .bind(Utc::now())
    .bind(false)
    .bind(false)
    .execute(&pool)
    .await
    .unwrap();

    // Create test CLI type
    let cli_type_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO cli_type (id, name, display_name, detect_command, is_system, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&cli_type_id)
    .bind("echo-cli")
    .bind("Echo CLI")
    .bind("echo test")
    .bind(false)
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    // Create model config
    let model_config_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO model_config (id, name, provider, model_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&model_config_id)
    .bind("test-model")
    .bind("openai")
    .bind("gpt-4")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    // Create workflow and task
    let wf_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO workflow (id, name, base_dir, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&wf_id)
    .bind("test-wf")
    .bind("/tmp")
    .bind("created")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let workflow_task_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO workflow_task (id, workflow_id, name, order_index, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&workflow_task_id)
    .bind(&wf_id)
    .bind("task-1")
    .bind(0)
    .bind("pending")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    // Create terminal
    let terminal_id = Uuid::new_v4().to_string();
    let terminal = Terminal {
        id: terminal_id.clone(),
        workflow_task_id,
        cli_type_id,
        model_config_id,
        custom_base_url: None,
        custom_api_key: None,
        role: None,
        role_description: None,
        order_index: 0,
        status: "not_started".to_string(),
        process_id: None,
        pty_session_id: None,
        vk_session_id: None,
        session_id: None,
        execution_process_id: None,
        last_commit_hash: None,
        last_commit_message: None,
        started_at: None,
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Terminal::create(&pool, &terminal).await.unwrap();

    // Execute launch_terminal
    let result = launcher.launch_terminal(&terminal).await;

    // Verify session was created
    let updated_terminal = Terminal::find_by_id(&pool, &terminal_id).await.unwrap().unwrap();

    assert!(updated_terminal.session_id.is_some(), "session_id should be set");
    assert!(updated_terminal.execution_process_id.is_some(), "execution_process_id should be set");

    // Verify session exists in database
    let session_id = Uuid::parse_str(&updated_terminal.session_id.unwrap()).unwrap();
    let session = Session::find_by_id(&pool, session_id).await.unwrap();
    assert!(session.is_some(), "Session should exist in database");
    let session = session.unwrap();
    assert_eq!(session.workspace_id, workspace_id);

    // Verify execution process exists
    let exec_process_id = Uuid::parse_str(&updated_terminal.execution_process_id.unwrap()).unwrap();
    let exec_process = ExecutionProcess::find_by_id(&pool, exec_process_id).await.unwrap();
    assert!(exec_process.is_some(), "ExecutionProcess should exist");
    let exec_process = exec_process.unwrap();
    assert_eq!(exec_process.session_id, session_id);
    assert_eq!(exec_process.run_reason, db::models::execution_process::ExecutionProcessRunReason::CodingAgent);

    // Process should be spawned
    assert!(result.success, "Launch should succeed");
    assert!(result.process_handle.is_some(), "Process handle should exist");
}
