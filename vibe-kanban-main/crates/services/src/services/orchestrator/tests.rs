//! Orchestrator unit tests
//!
//! Comprehensive test suite for LLM client, message bus, and Agent core functionality.

#[cfg(test)]
mod tests {
    use crate::services::orchestrator::{
        BusMessage, CommitMetadata, LLMMessage, MessageBus, MockLLMClient, OrchestratorAgent,
        OrchestratorConfig, OrchestratorInstruction, OrchestratorRunState, OrchestratorState,
        TerminalCompletionEvent, TerminalCompletionStatus, create_llm_client,
    };
    use std::sync::Arc;
    use tokio::sync::RwLock;

    // Tests will be added in subsequent tasks

    // =========================================================================
    // Test Suite 1: Types Serialization
    // =========================================================================

    #[test]
    fn test_orchestrator_instruction_serialization() {
        let instruction = OrchestratorInstruction::SendToTerminal {
            terminal_id: "terminal-1".to_string(),
            message: "Implement login feature".to_string(),
        };

        let json = serde_json::to_string(&instruction).unwrap();
        let parsed: OrchestratorInstruction = serde_json::from_str(&json).unwrap();

        match parsed {
            OrchestratorInstruction::SendToTerminal {
                terminal_id,
                message,
            } => {
                assert_eq!(terminal_id, "terminal-1");
                assert_eq!(message, "Implement login feature");
            }
            _ => panic!("Wrong instruction type"),
        }
    }

    #[test]
    fn test_terminal_completion_event_full() {
        let event = TerminalCompletionEvent {
            terminal_id: "terminal-1".to_string(),
            task_id: "task-1".to_string(),
            workflow_id: "workflow-1".to_string(),
            status: TerminalCompletionStatus::Completed,
            commit_hash: Some("abc123".to_string()),
            commit_message: Some("feat: add login".to_string()),
            metadata: Some(CommitMetadata {
                workflow_id: "workflow-1".to_string(),
                task_id: "task-1".to_string(),
                terminal_id: "terminal-1".to_string(),
                terminal_order: 1,
                cli: "claude".to_string(),
                model: "claude-4".to_string(),
                status: "completed".to_string(),
                severity: None,
                reviewed_terminal: None,
                issues: None,
                next_action: "review".to_string(),
            }),
        };

        let json = serde_json::to_string(&event).unwrap();
        let parsed: TerminalCompletionEvent = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.terminal_id, "terminal-1");
        assert_eq!(parsed.status, TerminalCompletionStatus::Completed);
        assert!(parsed.metadata.is_some());
    }

    #[test]
    fn test_all_instruction_variants() {
        let variants = vec![
            OrchestratorInstruction::StartTask {
                task_id: "task-1".to_string(),
                instruction: "Build API".to_string(),
            },
            OrchestratorInstruction::ReviewCode {
                terminal_id: "terminal-1".to_string(),
                commit_hash: "abc123".to_string(),
            },
            OrchestratorInstruction::FixIssues {
                terminal_id: "terminal-1".to_string(),
                issues: vec!["Bug in line 42".to_string()],
            },
            OrchestratorInstruction::MergeBranch {
                source_branch: "feature/login".to_string(),
                target_branch: "main".to_string(),
            },
            OrchestratorInstruction::PauseWorkflow {
                reason: "Need manual review".to_string(),
            },
            OrchestratorInstruction::CompleteWorkflow {
                summary: "All tasks completed".to_string(),
            },
            OrchestratorInstruction::FailWorkflow {
                reason: "Critical error".to_string(),
            },
        ];

        for instruction in variants {
            let json = serde_json::to_string(&instruction).unwrap();
            let parsed: OrchestratorInstruction = serde_json::from_str(&json).unwrap();

            // Verify type tag is correctly serialized
            let json_obj = serde_json::from_str::<serde_json::Value>(&json).unwrap();
            assert!(json_obj.get("type").is_some());
        }
    }

    // =========================================================================
    // Test Suite 2: Configuration
    // =========================================================================

    #[test]
    fn test_default_config() {
        let config = OrchestratorConfig::default();

        assert_eq!(config.api_type, "openai");
        assert_eq!(config.base_url, "https://api.openai.com/v1");
        assert_eq!(config.model, "gpt-4o");
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.timeout_secs, 120);
        assert!(!config.system_prompt.is_empty());
    }

    #[test]
    fn test_config_validation() {
        // Valid config
        let config = OrchestratorConfig {
            api_key: "sk-test-123".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_ok());

        // Missing API key
        let config = OrchestratorConfig {
            api_key: String::new(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_err());

        // Missing base URL
        let config = OrchestratorConfig {
            api_key: "sk-test-123".to_string(),
            base_url: String::new(),
            model: "gpt-4".to_string(),
            ..Default::default()
        };
        assert!(config.validate().is_err());

        // Missing model
        let config = OrchestratorConfig {
            api_key: "sk-test-123".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: String::new(),
            ..Default::default()
        };
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_from_workflow() {
        // All Some
        let config = OrchestratorConfig::from_workflow(
            Some("anthropic"),
            Some("https://api.anthropic.com"),
            Some("sk-ant-123"),
            Some("claude-4-opus"),
        );
        assert!(config.is_some());
        let config = config.unwrap();
        assert_eq!(config.api_type, "anthropic");
        assert_eq!(config.base_url, "https://api.anthropic.com");
        assert_eq!(config.api_key, "sk-ant-123");
        assert_eq!(config.model, "claude-4-opus");

        // None returns None
        let config = OrchestratorConfig::from_workflow(None, None, None, None);
        assert!(config.is_none());
    }

    // =========================================================================
    // Test Suite 3: State Management
    // =========================================================================

    #[tokio::test]
    async fn test_state_initialization() {
        let state = OrchestratorState::new("workflow-1".to_string());

        assert_eq!(state.workflow_id, "workflow-1");
        assert_eq!(state.run_state, OrchestratorRunState::Idle);
        assert!(state.task_states.is_empty());
        assert!(state.conversation_history.is_empty());
        assert!(state.pending_events.is_empty());
        assert_eq!(state.total_tokens_used, 0);
        assert_eq!(state.error_count, 0);
    }

    #[tokio::test]
    async fn test_task_init_and_tracking() {
        let mut state = OrchestratorState::new("workflow-1".to_string());

        state.init_task("task-1".to_string(), 3);

        assert!(state.task_states.contains_key("task-1"));
        let task_state = state.task_states.get("task-1").unwrap();
        assert_eq!(task_state.task_id, "task-1");
        assert_eq!(task_state.total_terminals, 3);
        assert_eq!(task_state.current_terminal_index, 0);
        assert!(task_state.completed_terminals.is_empty());
        assert!(task_state.failed_terminals.is_empty());
        assert!(!task_state.is_completed);
    }

    #[tokio::test]
    async fn test_terminal_completion_marking() {
        let mut state = OrchestratorState::new("workflow-1".to_string());
        state.init_task("task-1".to_string(), 3);

        // Mark first terminal as completed
        state.mark_terminal_completed("task-1", "terminal-1", true);

        {
            let task_state = state.task_states.get("task-1").unwrap();
            assert_eq!(task_state.completed_terminals.len(), 1);
            assert!(
                task_state
                    .completed_terminals
                    .contains(&"terminal-1".to_string())
            );
            assert!(!task_state.is_completed);
        }

        // Mark second as failed
        state.mark_terminal_completed("task-1", "terminal-2", false);
        {
            let task_state = state.task_states.get("task-1").unwrap();
            assert_eq!(task_state.failed_terminals.len(), 1);
        }

        // Mark third as completed - should complete the task
        state.mark_terminal_completed("task-1", "terminal-3", true);
        {
            let task_state = state.task_states.get("task-1").unwrap();
            assert!(task_state.is_completed);
        }
    }

    #[tokio::test]
    async fn test_conversation_history() {
        let mut state = OrchestratorState::new("workflow-1".to_string());

        state.add_message("system", "You are a helpful assistant");
        state.add_message("user", "Hello");
        state.add_message("assistant", "Hi there!");

        assert_eq!(state.conversation_history.len(), 3);
        assert_eq!(state.conversation_history[0].role, "system");
        assert_eq!(state.conversation_history[1].content, "Hello");
    }

    #[tokio::test]
    async fn test_conversation_history_pruning() {
        let mut state = OrchestratorState::new("workflow-1".to_string());

        // Add system message
        state.add_message("system", "System prompt");

        // Add 60 user messages (exceeds MAX_HISTORY of 50)
        for i in 0..60 {
            state.add_message("user", &format!("Message {}", i));
            state.add_message("assistant", &format!("Response {}", i));
        }

        // History should be pruned to MAX_HISTORY, keeping system messages
        assert!(state.conversation_history.len() <= 51); // 1 system + 50 recent
        assert_eq!(state.conversation_history[0].role, "system");
    }

    #[tokio::test]
    async fn test_all_tasks_completed() {
        let mut state = OrchestratorState::new("workflow-1".to_string());

        state.init_task("task-1".to_string(), 2);
        state.init_task("task-2".to_string(), 1);

        assert!(!state.all_tasks_completed());

        // Complete task-2
        state.mark_terminal_completed("task-2", "terminal-1", true);
        assert!(!state.all_tasks_completed());

        // Complete task-1
        state.mark_terminal_completed("task-1", "terminal-1", true);
        state.mark_terminal_completed("task-1", "terminal-2", true);
        assert!(state.all_tasks_completed());
    }

    // =========================================================================
    // Test Suite 4: LLM Client
    // =========================================================================

    #[tokio::test]
    async fn test_llm_client_basic_request() {
        // Install crypto provider for reqwest (ignore if already installed)
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

        use wiremock::{
            Mock, MockServer, ResponseTemplate,
            matchers::{method, path},
        };

        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "Hello! How can I help you?"
                    }
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 9,
                    "total_tokens": 19
                }
            })))
            .mount(&mock_server)
            .await;

        let config = OrchestratorConfig {
            base_url: mock_server.uri(),
            api_key: "test-key".to_string(),
            model: "gpt-4".to_string(),
            ..Default::default()
        };

        let client = create_llm_client(&config).unwrap();
        let messages = vec![LLMMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }];

        let response = client.chat(messages).await.unwrap();

        assert!(response.content.contains("Hello"));
        assert!(response.usage.is_some());
        let usage = response.usage.unwrap();
        assert_eq!(usage.total_tokens, 19);
    }

    #[tokio::test]
    async fn test_llm_client_error_handling() {
        // Install crypto provider for reqwest (ignore if already installed)
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

        use wiremock::{
            Mock, MockServer, ResponseTemplate,
            matchers::{method, path},
        };

        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(ResponseTemplate::new(401).set_body_json(serde_json::json!({
                "error": {
                    "message": "Invalid API key",
                    "type": "invalid_request_error"
                }
            })))
            .mount(&mock_server)
            .await;

        let config = OrchestratorConfig {
            base_url: mock_server.uri(),
            api_key: "invalid-key".to_string(),
            model: "gpt-4".to_string(),
            ..Default::default()
        };

        let client = create_llm_client(&config).unwrap();
        let messages = vec![LLMMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }];

        let result = client.chat(messages).await;

        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_llm_client_empty_response() {
        // Install crypto provider for reqwest (ignore if already installed)
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

        use wiremock::{
            Mock, MockServer, ResponseTemplate,
            matchers::{method, path},
        };

        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "choices": []
            })))
            .mount(&mock_server)
            .await;

        let config = OrchestratorConfig {
            base_url: mock_server.uri(),
            api_key: "test-key".to_string(),
            model: "gpt-4".to_string(),
            ..Default::default()
        };

        let client = create_llm_client(&config).unwrap();
        let messages = vec![LLMMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }];

        let response = client.chat(messages).await.unwrap();

        assert_eq!(response.content, "");
    }

    // =========================================================================
    // Test Suite 5: Message Bus
    // =========================================================================

    #[tokio::test]
    async fn test_message_bus_creation() {
        let bus = MessageBus::new(100);

        // Should be able to create broadcast subscribers
        let _sub1 = bus.subscribe_broadcast();
        let _sub2 = bus.subscribe_broadcast();

        // Broadcast should work
        let result = bus.broadcast(BusMessage::Shutdown);
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_message_bus_topic_subscription() {
        let bus = MessageBus::new(100);
        let mut subscriber = bus.subscribe("workflow:wf-1").await;

        // Publish to topic
        bus.publish(
            "workflow:wf-1",
            BusMessage::StatusUpdate {
                workflow_id: "wf-1".to_string(),
                status: "running".to_string(),
            },
        )
        .await;

        // Receive message
        let msg =
            tokio::time::timeout(std::time::Duration::from_millis(100), subscriber.recv()).await;

        assert!(msg.is_ok());
        let msg = msg.unwrap().unwrap();
        match msg {
            BusMessage::StatusUpdate {
                workflow_id,
                status,
            } => {
                assert_eq!(workflow_id, "wf-1");
                assert_eq!(status, "running");
            }
            _ => panic!("Wrong message type"),
        }
    }

    #[tokio::test]
    async fn test_message_bus_topic_isolation() {
        let bus = MessageBus::new(100);

        let mut sub_wf1 = bus.subscribe("workflow:wf-1").await;
        let mut sub_wf2 = bus.subscribe("workflow:wf-2").await;

        // Publish to wf-1 only
        bus.publish(
            "workflow:wf-1",
            BusMessage::StatusUpdate {
                workflow_id: "wf-1".to_string(),
                status: "running".to_string(),
            },
        )
        .await;

        // wf-1 should receive
        let msg = tokio::time::timeout(std::time::Duration::from_millis(100), sub_wf1.recv()).await;
        assert!(msg.is_ok());

        // wf-2 should NOT receive (timeout)
        let msg = tokio::time::timeout(std::time::Duration::from_millis(100), sub_wf2.recv()).await;
        assert!(msg.is_err());
    }

    #[tokio::test]
    async fn test_message_bus_broadcast() {
        let bus = MessageBus::new(100);

        let mut sub1 = bus.subscribe_broadcast();
        let mut sub2 = bus.subscribe_broadcast();

        bus.broadcast(BusMessage::Shutdown).unwrap();

        // Both should receive
        let msg1 = tokio::time::timeout(std::time::Duration::from_millis(100), sub1.recv()).await;
        assert!(msg1.is_ok());

        let msg2 = tokio::time::timeout(std::time::Duration::from_millis(100), sub2.recv()).await;
        assert!(msg2.is_ok());
    }

    #[tokio::test]
    async fn test_publish_terminal_completed() {
        let bus = MessageBus::new(100);
        let mut sub = bus.subscribe("workflow:wf-1").await;

        let event = TerminalCompletionEvent {
            terminal_id: "terminal-1".to_string(),
            task_id: "task-1".to_string(),
            workflow_id: "wf-1".to_string(),
            status: TerminalCompletionStatus::Completed,
            commit_hash: Some("abc123".to_string()),
            commit_message: Some("feat: add feature".to_string()),
            metadata: None,
        };

        bus.publish_terminal_completed(event).await;

        let msg = tokio::time::timeout(std::time::Duration::from_millis(100), sub.recv())
            .await
            .unwrap()
            .unwrap();

        match msg {
            BusMessage::TerminalCompleted(e) => {
                assert_eq!(e.terminal_id, "terminal-1");
                assert_eq!(e.workflow_id, "wf-1");
            }
            _ => panic!("Wrong message type"),
        }
    }

    // =========================================================================
    // Test Suite 6: OrchestratorAgent
    // =========================================================================

    #[test]
    fn test_instruction_parsing() {
        let json = r#"{"type":"send_to_terminal","terminal_id":"t1","message":"Do something"}"#;

        let instruction: OrchestratorInstruction = serde_json::from_str(json).unwrap();

        match instruction {
            OrchestratorInstruction::SendToTerminal {
                terminal_id,
                message,
            } => {
                assert_eq!(terminal_id, "t1");
                assert_eq!(message, "Do something");
            }
            _ => panic!("Wrong instruction type"),
        }
    }

    #[test]
    fn test_all_instruction_parsing() {
        let test_cases = vec![
            (
                r#"{"type":"start_task","task_id":"task-1","instruction":"Build API"}"#,
                "start_task",
            ),
            (
                r#"{"type":"review_code","terminal_id":"t1","commit_hash":"abc123"}"#,
                "review_code",
            ),
            (
                r#"{"type":"fix_issues","terminal_id":"t1","issues":["bug1","bug2"]}"#,
                "fix_issues",
            ),
            (
                r#"{"type":"merge_branch","source_branch":"feature","target_branch":"main"}"#,
                "merge_branch",
            ),
            (
                r#"{"type":"pause_workflow","reason":"manual review"}"#,
                "pause_workflow",
            ),
            (
                r#"{"type":"complete_workflow","summary":"done"}"#,
                "complete_workflow",
            ),
            (
                r#"{"type":"fail_workflow","reason":"error"}"#,
                "fail_workflow",
            ),
        ];

        for (json, expected_type) in test_cases {
            let instruction: OrchestratorInstruction = serde_json::from_str(json).unwrap();
            let json_obj = serde_json::from_str::<serde_json::Value>(json).unwrap();
            assert_eq!(json_obj["type"], expected_type);
        }
    }

    #[tokio::test]
    async fn test_agent_creation() {
        use db::DBService;
        use sqlx::sqlite::SqlitePoolOptions;
        use std::path::PathBuf;
        use std::sync::Arc;

        // Create in-memory database with migrations
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .unwrap();

        // Run migrations
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let migration_dir = manifest_dir
            .ancestors()
            .nth(1)
            .unwrap()
            .join("db")
            .join("migrations");

        let migrator = sqlx::migrate::Migrator::new(migration_dir)
            .await
            .unwrap();
        migrator.run(&pool).await.unwrap();

        let db = Arc::new(DBService { pool });

        // Create message bus with capacity (SharedMessageBus = Arc<MessageBus>)
        let message_bus = Arc::new(MessageBus::new(100));

        // Create orchestrator config
        let config = OrchestratorConfig {
            api_type: "openai".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: "test-key".to_string(),
            model: "gpt-4o".to_string(),
            ..Default::default()
        };

        // Verify config validation works
        assert!(config.validate().is_ok(), "Config with api_key should be valid");

        // Create mock LLM client for testing
        let mock_llm_client = Box::new(MockLLMClient::new());

        // Create agent using mock LLM client (full agent creation test)
        let result = OrchestratorAgent::with_llm_client(
            config,
            "test-workflow".to_string(),
            message_bus,
            db,
            mock_llm_client,
        ).await;

        // Verify agent creation succeeds
        assert!(result.is_ok(), "Agent creation with mock LLM client should succeed");

        let _agent = result.unwrap();

        // Agent creation succeeded - this verifies:
        // 1. Mock LLM client infrastructure works
        // 2. Agent can be created with mock client
        // 3. All dependencies (DB, MessageBus, State) are properly initialized
        // Note: state field is private, so we can't inspect it directly
    }

    #[tokio::test]
    async fn test_execute_instruction_send_to_terminal() {
        use db::DBService;
        use sqlx::sqlite::SqlitePoolOptions;
        use std::path::PathBuf;
        use std::sync::Arc;
        use uuid::Uuid;

        // Create in-memory database with migrations
        let pool = SqlitePoolOptions::new()
            .connect(":memory:")
            .await
            .unwrap();

        // Run migrations
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let migration_dir = manifest_dir
            .ancestors()
            .nth(1)
            .unwrap()
            .join("db")
            .join("migrations");

        let migrator = sqlx::migrate::Migrator::new(migration_dir)
            .await
            .unwrap();
        migrator.run(&pool).await.unwrap();

        let db = Arc::new(DBService { pool: pool.clone() });

        // Create workflow, task and terminal in database
        let workflow_id = Uuid::new_v4().to_string();
        let task_id = Uuid::new_v4().to_string();
        let terminal_id = Uuid::new_v4().to_string();
        let pty_session_id = Uuid::new_v4().to_string();

        // First, we need to insert a project (required by workflow)
        let project_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)"
        )
        .bind(&project_id)
        .bind("test-project")
        .bind(chrono::Utc::now())
        .bind(chrono::Utc::now())
        .execute(&pool)
        .await
        .unwrap();

        // Insert workflow
        sqlx::query(
            r#"
            INSERT INTO workflow (
                id, project_id, name, target_branch,
                merge_terminal_cli_id, merge_terminal_model_id,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            "#
        )
        .bind(&workflow_id)
        .bind(&project_id)
        .bind("test-workflow")
        .bind("main")
        .bind("cli-claude-code") // From migration
        .bind("model-claude-sonnet") // From migration
        .bind(chrono::Utc::now())
        .bind(chrono::Utc::now())
        .execute(&pool)
        .await
        .unwrap();

        // Insert workflow_task
        sqlx::query(
            r#"
            INSERT INTO workflow_task (
                id, workflow_id, name, branch, order_index,
                created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
            "#
        )
        .bind(&task_id)
        .bind(&workflow_id)
        .bind("test-task")
        .bind("feature/test")
        .bind(0)
        .bind(chrono::Utc::now())
        .bind(chrono::Utc::now())
        .execute(&pool)
        .await
        .unwrap();

        // Insert terminal record
        sqlx::query(
            r#"
            INSERT INTO terminal (
                id, workflow_task_id, cli_type_id, model_config_id,
                order_index, status, pty_session_id, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#
        )
        .bind(&terminal_id)
        .bind(&task_id)
        .bind("cli-claude-code") // From migration
        .bind("model-claude-sonnet") // From migration
        .bind(0)
        .bind("waiting")
        .bind(&pty_session_id)
        .bind(chrono::Utc::now())
        .bind(chrono::Utc::now())
        .execute(&pool)
        .await
        .unwrap();

        let config = OrchestratorConfig {
            api_type: "openai".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            api_key: "sk-test".to_string(),
            model: "gpt-4".to_string(),
            ..Default::default()
        };

        let message_bus = Arc::new(MessageBus::new(100));
        let mock_llm = Box::new(MockLLMClient::new());

        let agent = OrchestratorAgent::with_llm_client(
            config.clone(),
            workflow_id.clone(),
            message_bus.clone(),
            db.clone(),
            mock_llm,
        ).await.unwrap();

        // Subscribe to terminal topic to verify message sent
        let mut terminal_rx = message_bus.subscribe(&pty_session_id).await;

        // Execute instruction
        let instruction_json = format!(
            r#"{{"type":"send_to_terminal","terminal_id":"{}","message":"echo test"}}"#,
            terminal_id
        );

        // Run in task to allow async message propagation
        tokio::spawn(async move {
            let _ = agent.execute_instruction(&instruction_json).await;
        });

        // Verify message received on terminal topic
        let timeout = tokio::time::timeout(
            tokio::time::Duration::from_millis(500),
            terminal_rx.recv()
        ).await;

        assert!(timeout.is_ok(), "Should receive message within timeout");

        let msg = timeout.unwrap();
        assert!(msg.is_some(), "Should receive a message");

        match msg.as_ref().unwrap() {
            BusMessage::TerminalMessage { message } => {
                assert_eq!(message, "echo test");
            }
            other => panic!("Expected TerminalMessage, got {:?}", other),
        }
    }
}
