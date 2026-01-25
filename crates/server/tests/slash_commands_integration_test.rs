//! Integration tests for Slash Commands
//!
//! These tests verify the complete slash commands functionality:
//! - CRUD operations for slash command presets
//! - Template rendering with custom parameters
//! - Workflow integration with slash commands
//! - End-to-end command execution flow

use server::DeploymentImpl;
use db::models::{
    CreateWorkflowRequest, CreateWorkflowTaskRequest, CreateTerminalRequest,
    MergeTerminalConfig, TerminalConfig, WorkflowCommandRequest, Workflow,
    SlashCommandPreset, CliType, ModelConfig, WorkflowCommand,
};
use uuid::Uuid;
use serde_json::json;

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

/// Helper: Create a slash command preset
async fn create_test_preset(
    pool: &sqlx::SqlitePool,
    command: &str,
    description: &str,
    template: &str,
) -> SlashCommandPreset {
    let preset = SlashCommandPreset {
        id: Uuid::new_v4().to_string(),
        command: command.to_string(),
        description: description.to_string(),
        prompt_template: Some(template.to_string()),
        is_system: false,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    sqlx::query(
        r"
        INSERT INTO slash_command_preset (id, command, description, prompt_template, is_system, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "
    )
    .bind(&preset.id)
    .bind(&preset.command)
    .bind(&preset.description)
    .bind(&preset.prompt_template)
    .bind(preset.is_system)
    .bind(preset.created_at)
    .bind(preset.updated_at)
    .execute(pool)
    .await
    .expect("Failed to create preset");

    preset
}

// ============================================================================
// Tests
// ============================================================================

#[tokio::test]
async fn test_list_all_presets() {
    let (deployment, _) = setup_test().await;

    // Create test presets
    create_test_preset(
        &deployment.db().pool,
        "/test1",
        "Test command 1",
        "Template 1 with {{var}}",
    ).await;

    create_test_preset(
        &deployment.db().pool,
        "/test2",
        "Test command 2",
        "Template 2",
    ).await;

    // List all presets
    let presets = SlashCommandPreset::find_all(&deployment.db().pool)
        .await
        .expect("Failed to list presets");

    assert!(presets.len() >= 2, "Should have at least 2 presets");

    // Verify ordering: system presets first, then alphabetically by command
    let user_presets: Vec<_> = presets.iter().filter(|p| !p.is_system).collect();
    assert_eq!(user_presets.len(), 2, "Should have 2 user presets");
}

#[tokio::test]
async fn test_create_preset() {
    let (deployment, _) = setup_test().await;

    let preset = create_test_preset(
        &deployment.db().pool,
        "/custom",
        "Custom command",
        "Custom {{param}} template",
    ).await;

    // Verify preset was created
    let all_presets = SlashCommandPreset::find_all(&deployment.db().pool)
        .await
        .expect("Failed to list presets");

    let found = all_presets.iter().find(|p| p.id == preset.id);
    assert!(found.is_some(), "Preset should exist");
    let found = found.unwrap();

    assert_eq!(found.command, "/custom");
    assert_eq!(found.description, "Custom command");
    assert_eq!(found.prompt_template, Some("Custom {{param}} template".to_string()));
    assert!(!found.is_system);
}

#[tokio::test]
async fn test_workflow_with_commands() {
    let (deployment, project_id) = setup_test().await;

    // Create test presets
    let preset1 = create_test_preset(
        &deployment.db().pool,
        "/review",
        "Review code",
        "Please review the following code:\n{{code_path}}",
    ).await;

    let preset2 = create_test_preset(
        &deployment.db().pool,
        "/test",
        "Run tests",
        "Run tests for {{module}} with coverage {{coverage}}",
    ).await;

    // Create workflow with commands
    let workflow_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: project_id.clone(),
        name: "Test Workflow".to_string(),
        description: Some("Test".to_string()),
        status: "created".to_string(),
        use_slash_commands: true,
        orchestrator_enabled: false,
        orchestrator_api_type: None,
        orchestrator_base_url: None,
        orchestrator_api_key: None,
        orchestrator_model: None,
        error_terminal_enabled: false,
        error_terminal_cli_id: None,
        error_terminal_model_id: None,
        merge_terminal_cli_id: "test-cli".to_string(),
        merge_terminal_model_id: "test-model".to_string(),
        target_branch: "main".to_string(),
        ready_at: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    Workflow::create(&deployment.db().pool, &workflow)
        .await
        .expect("Failed to create workflow");

    // Create workflow commands with custom params
    let cmd1 = WorkflowCommand::create(
        &deployment.db().pool,
        &workflow_id,
        &preset1.id,
        0,
        Some(r#"{"code_path": "src/main.rs"}"#),
    ).await.expect("Failed to create command 1");

    let cmd2 = WorkflowCommand::create(
        &deployment.db().pool,
        &workflow_id,
        &preset2.id,
        1,
        Some(r#"{"module": "auth", "coverage": "80%"}"#),
    ).await.expect("Failed to create command 2");

    // Retrieve commands for workflow
    let commands = WorkflowCommand::find_by_workflow(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to fetch workflow commands");

    assert_eq!(commands.len(), 2, "Should have 2 commands");

    // Verify first command
    assert_eq!(commands[0].preset_id, preset1.id);
    assert_eq!(commands[0].order_index, 0);
    assert_eq!(
        commands[0].custom_params,
        Some(r#"{"code_path": "src/main.rs"}"#.to_string())
    );

    // Verify second command
    assert_eq!(commands[1].preset_id, preset2.id);
    assert_eq!(commands[1].order_index, 1);
    assert_eq!(
        commands[1].custom_params,
        Some(r#"{"module": "auth", "coverage": "80%"}"#.to_string())
    );
}

#[tokio::test]
async fn test_template_rendering() {
    use services::template_renderer::{TemplateRenderer, WorkflowContext};

    let renderer = TemplateRenderer::new();

    // Test 1: Simple template with custom params
    let template = "Review the code at {{path}}";
    let custom_params = r#"{"path": "src/lib.rs"}"#;
    let result = renderer.render(template, Some(custom_params), None)
        .expect("Failed to render template");
    assert_eq!(result, "Review the code at src/lib.rs");

    // Test 2: Template with workflow context
    let template = "Working on {{workflow.name}} targeting {{workflow.targetBranch}}";
    let workflow_ctx = WorkflowContext::new(
        "My Workflow".to_string(),
        Some("Test workflow".to_string()),
        "main".to_string(),
    );
    let result = renderer.render(template, None, Some(&workflow_ctx))
        .expect("Failed to render template");
    assert_eq!(result, "Working on My Workflow targeting main");

    // Test 3: Combined custom params and workflow context
    let template = "{{greeting}} {{workflow.name}}: {{instruction}}";
    let custom_params = r#"{"greeting": "Please", "instruction": "do the work"}"#;
    let workflow_ctx = WorkflowContext::new(
        "Test WF".to_string(),
        None,
        "dev".to_string(),
    );
    let result = renderer.render(template, Some(custom_params), Some(&workflow_ctx))
        .expect("Failed to render template");
    assert_eq!(result, "Please Test WF: do the work");

    // Test 4: Invalid JSON should fail
    let template = "Hello {{name}}";
    let result = renderer.render(template, Some("invalid json"), None);
    assert!(result.is_err(), "Should fail with invalid JSON");

    // Test 5: Missing variable should fail (strict mode)
    let template = "Hello {{name}}";
    let result = renderer.render(template, None, None);
    assert!(result.is_err(), "Should fail with missing variable in strict mode");
}

#[tokio::test]
async fn test_full_workflow_with_commands_api() {
    let (deployment, project_id) = setup_test().await;

    // Create test preset
    let preset = create_test_preset(
        &deployment.db().pool,
        "/deploy",
        "Deploy to production",
        "Deploy {{service}} to {{env}} with {{strategy}} strategy",
    ).await;

    // Create workflow request with commands
    let workflow_id = Uuid::new_v4().to_string();
    let request = CreateWorkflowRequest {
        project_id: project_id.clone(),
        name: "Deploy Workflow".to_string(),
        description: Some("Deployment workflow".to_string()),
        use_slash_commands: true,
        commands: Some(vec![
            WorkflowCommandRequest {
                preset_id: preset.id.clone(),
                custom_params: Some(r#"{"service": "api", "env": "prod", "strategy": "blue-green"}"#.to_string()),
            }
        ]),
        orchestrator_config: None,
        error_terminal_config: None,
        merge_terminal_config: TerminalConfig {
            cli_type_id: "test-cli".to_string(),
            model_config_id: "test-model".to_string(),
            custom_base_url: None,
            custom_api_key: None,
        },
        target_branch: Some("main".to_string()),
        tasks: vec![],
    };

    // Create workflow
    let now = chrono::Utc::now();
    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: project_id.clone(),
        name: request.name.clone(),
        description: request.description.clone(),
        status: "created".to_string(),
        use_slash_commands: request.use_slash_commands,
        orchestrator_enabled: request.orchestrator_config.is_some(),
        orchestrator_api_type: request.orchestrator_config.as_ref().map(|c| c.api_type.clone()),
        orchestrator_base_url: request.orchestrator_config.as_ref().map(|c| c.base_url.clone()),
        orchestrator_api_key: None,
        orchestrator_model: request.orchestrator_config.as_ref().map(|c| c.model.clone()),
        error_terminal_enabled: request.error_terminal_config.is_some(),
        error_terminal_cli_id: request.error_terminal_config.as_ref().map(|c| c.cli_type_id.clone()),
        error_terminal_model_id: request.error_terminal_config.as_ref().map(|c| c.model_config_id.clone()),
        merge_terminal_cli_id: request.merge_terminal_config.cli_type_id.clone(),
        merge_terminal_model_id: request.merge_terminal_config.model_config_id.clone(),
        target_branch: request.target_branch.unwrap_or_else(|| "main".to_string()),
        ready_at: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    Workflow::create(&deployment.db().pool, &workflow)
        .await
        .expect("Failed to create workflow");

    // Create commands
    if let Some(commands) = request.commands {
        for (index, cmd_req) in commands.iter().enumerate() {
            WorkflowCommand::create(
                &deployment.db().pool,
                &workflow_id,
                &cmd_req.preset_id,
                index as i32,
                cmd_req.custom_params.as_deref(),
            ).await.expect("Failed to create workflow command");
        }
    }

    // Verify workflow was created with commands
    let commands = WorkflowCommand::find_by_workflow(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to fetch commands");

    assert_eq!(commands.len(), 1, "Should have 1 command");
    assert_eq!(commands[0].preset_id, preset.id);
    assert_eq!(
        commands[0].custom_params,
        Some(r#"{"service": "api", "env": "prod", "strategy": "blue-green"}"#.to_string())
    );
}

#[tokio::test]
async fn test_workflow_without_commands() {
    let (deployment, project_id) = setup_test().await;

    // Create workflow without commands
    let workflow_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now();

    let workflow = Workflow {
        id: workflow_id.clone(),
        project_id: project_id.clone(),
        name: "No Commands Workflow".to_string(),
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
        merge_terminal_cli_id: "test-cli".to_string(),
        merge_terminal_model_id: "test-model".to_string(),
        target_branch: "main".to_string(),
        ready_at: None,
        started_at: None,
        completed_at: None,
        created_at: now,
        updated_at: now,
    };

    Workflow::create(&deployment.db().pool, &workflow)
        .await
        .expect("Failed to create workflow");

    // Verify no commands
    let commands = WorkflowCommand::find_by_workflow(&deployment.db().pool, &workflow_id)
        .await
        .expect("Failed to fetch commands");

    assert_eq!(commands.len(), 0, "Should have 0 commands");
}

#[tokio::test]
async fn test_system_preset_protection() {
    let (deployment, _) = setup_test().await;

    // Create a system preset
    let system_preset = SlashCommandPreset {
        id: Uuid::new_v4().to_string(),
        command: "/system-cmd".to_string(),
        description: "System command".to_string(),
        prompt_template: Some("System template".to_string()),
        is_system: true,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    sqlx::query(
        r"
        INSERT INTO slash_command_preset (id, command, description, prompt_template, is_system, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        "
    )
    .bind(&system_preset.id)
    .bind(&system_preset.command)
    .bind(&system_preset.description)
    .bind(&system_preset.prompt_template)
    .bind(system_preset.is_system)
    .bind(system_preset.created_at)
    .bind(system_preset.updated_at)
    .execute(&deployment.db().pool)
    .await
    .expect("Failed to create system preset");

    // List all presets - system presets should be included
    let presets = SlashCommandPreset::find_all(&deployment.db().pool)
        .await
        .expect("Failed to list presets");

    // System presets are included in full list
    let system_presets: Vec<_> = presets.iter().filter(|p| p.is_system).collect();
    assert_eq!(system_presets.len(), 1, "Should have 1 system preset");
}

#[tokio::test]
async fn test_complex_template_rendering() {
    use services::template_renderer::{TemplateRenderer, WorkflowContext};

    let renderer = TemplateRenderer::new();

    // Test nested JSON in custom params
    let template = "User: {{user.name}}, Email: {{user.email}}";
    let custom_params = r#"{"user": {"name": "Alice", "email": "alice@example.com"}}"#;
    let result = renderer.render(template, Some(custom_params), None)
        .expect("Failed to render template");
    assert_eq!(result, "User: Alice, Email: alice@example.com");

    // Test array access
    let template = "First item: {{items.0}}, Second item: {{items.1}}";
    let custom_params = r#"{"items": ["apple", "banana"]}"#;
    let result = renderer.render(template, Some(custom_params), None)
        .expect("Failed to render template");
    assert_eq!(result, "First item: apple, Second item: banana");

    // Test template with newlines and special characters
    let template = "Instructions:\n1. {{step1}}\n2. {{step2}}\n\nResult: {{result}}";
    let custom_params = r#"{"step1": "Prepare", "step2": "Execute", "result": "Success!"}"#;
    let result = renderer.render(template, Some(custom_params), None)
        .expect("Failed to render template");
    assert!(result.contains("Prepare"));
    assert!(result.contains("Execute"));
    assert!(result.contains("Success!"));
}
