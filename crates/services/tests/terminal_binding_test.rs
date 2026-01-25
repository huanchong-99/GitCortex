use services::services::terminal::TerminalLauncher;
use db::{DBService, models::Terminal};
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

    // Create test workflow, task, and terminal
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

    let task_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO workflow_task (id, workflow_id, name, order_index, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&task_id)
    .bind(&wf_id)
    .bind("task-1")
    .bind(0)
    .bind("pending")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let terminal_id = Uuid::new_v4().to_string();
    let terminal = Terminal {
        id: terminal_id.clone(),
        workflow_task_id: task_id.clone(),
        cli_type_id: "test-cli".to_string(),
        model_config_id: Uuid::new_v4().to_string(),
        custom_base_url: None,
        custom_api_key: None,
        role: Some("coder".to_string()),
        role_description: None,
        order_index: 0,
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
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // Act: Launch terminal
    let result = launcher.launch_terminal(&terminal).await;

    // Assert: Session should be created
    let session = sqlx::query!(
        "SELECT * FROM sessions WHERE terminal_id = ?"
    )
    .bind(&terminal_id)
    .fetch_optional(&pool)
    .await
    .unwrap();

    assert!(session.is_some(), "Session should be created for terminal");
    let session = session.unwrap();
    assert_eq!(session.terminal_id, Some(terminal_id));
}
