use db::models::{CreateWorkflowRequest, CreateWorkflowTaskRequest, CreateTerminalRequest, OrchestratorConfig, TerminalConfig};

#[test]
fn test_create_workflow_request_with_tasks() {
    let req = CreateWorkflowRequest {
        project_id: "proj-test".to_string(),
        name: "Test Workflow".to_string(),
        description: Some("Test description".to_string()),
        use_slash_commands: false,
        command_preset_ids: None,
        orchestrator_config: None,
        error_terminal_config: None,
        merge_terminal_config: TerminalConfig {
            cli_type_id: "cli-claude-code".to_string(),
            model_config_id: "model-sonnet".to_string(),
            custom_base_url: None,
            custom_api_key: None,
        },
        target_branch: Some("main".to_string()),
        tasks: vec![
            CreateWorkflowTaskRequest {
                id: None,
                name: "Task 1".to_string(),
                description: Some("First task".to_string()),
                branch: None,
                order_index: 0,
                terminals: vec![
                    CreateTerminalRequest {
                        id: None,
                        cli_type_id: "cli-claude-code".to_string(),
                        model_config_id: "model-sonnet".to_string(),
                        custom_base_url: None,
                        custom_api_key: None,
                        role: Some("Code Writer".to_string()),
                        role_description: None,
                        order_index: 0,
                    }
                ],
            }
        ],
    };

    assert_eq!(req.tasks.len(), 1);
    assert_eq!(req.tasks[0].terminals.len(), 1);
}
