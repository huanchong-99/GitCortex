use db::{DBService, models::Terminal, models::terminal::TerminalLog};
use uuid::Uuid;
use chrono::Utc;

#[tokio::test]
async fn test_terminal_output_logged() {
    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    let m = sqlx::migrate::Migrator::new(std::path::PathBuf::from("../../crates/db/migrations")).await.unwrap();
    m.run(&pool).await.unwrap();

    let db = DBService { pool };

    // Create terminal
    let terminal_id = Uuid::new_v4().to_string();
    let wf_id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO workflow (id, name, base_dir, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(&wf_id).bind("test").bind("/tmp").bind("created").bind(Utc::now()).bind(Utc::now())
        .execute(&db.pool).await.unwrap();

    let terminal = Terminal {
        id: terminal_id.clone(),
        workflow_task_id: wf_id,
        cli_type_id: "test".to_string(),
        model_config_id: "test".to_string(),
        custom_base_url: None,
        custom_api_key: None,
        role: None,
        role_description: None,
        order_index: 0,
        status: "running".to_string(),
        process_id: None,
        pty_session_id: None,
        vk_session_id: None,
        session_id: None,
        execution_process_id: None,
        last_commit_hash: None,
        last_commit_message: None,
        started_at: Some(Utc::now()),
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    Terminal::create(&db.pool, &terminal).await.unwrap();

    // Log output
    TerminalLog::create(&db.pool, &terminal_id, "stdout", "test output").await.unwrap();

    // Verify log exists
    let logs = TerminalLog::find_by_terminal(&db.pool, &terminal_id, Some(10)).await.unwrap();
    assert_eq!(logs.len(), 1);
    assert_eq!(logs[0].content, "test output");
}
