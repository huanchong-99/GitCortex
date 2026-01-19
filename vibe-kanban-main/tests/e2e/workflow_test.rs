//! End-to-End Tests for Workflow System
//!
//! Tests the complete workflow orchestration system including:
//! - CLI type detection and management
//! - Model configuration
//! - Workflow CRUD operations
//! - Workflow lifecycle management
//! - Error handling
//!
//! Prerequisites:
//! - Server running on http://localhost:3001
//! - Database initialized with seed data

use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use uuid::Uuid;

const SERVER_URL: &str = "http://localhost:3001";
const API_BASE: &str = "http://localhost:3001/api";

/// HTTP client with timeout
fn client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
}

/// Generate test project ID
fn test_project_id() -> String {
    Uuid::new_v4().to_string()
}

/// Get test API key from environment or use fallback
fn get_test_api_key() -> String {
    std::env::var("TEST_ORCHESTRATOR_API_KEY")
        .unwrap_or_else(|_| "sk-test-key-12345".to_string())
}

/// Ensure server is running before executing tests
async fn ensure_server_running() {
    let client = client();
    let response = client
        .get(&format!("{}/cli_types", API_BASE))
        .timeout(Duration::from_secs(5))
        .send()
        .await;

    if response.is_err() {
        panic!(
            "Server is not running on {}. Please start the server first.",
            SERVER_URL
        );
    }
}

/// Helper: Get first CLI type ID from the API
async fn get_first_cli_type(client: &Client) -> String {
    let cli_response = client
        .get(&format!("{}/cli_types", API_BASE))
        .send()
        .await
        .expect("Failed to GET /cli_types - server may not be running");

    assert_eq!(
        cli_response.status(),
        200,
        "GET /cli_types returned error status: {}",
        cli_response.status()
    );

    let cli_types: Vec<serde_json::Value> = cli_response
        .json()
        .await
        .expect("Failed to parse CLI types response");

    assert!(
        !cli_types.is_empty(),
        "No CLI types found - database may not be seeded"
    );

    cli_types[0]["id"]
        .as_str()
        .expect("CLI type ID should be a string")
        .to_string()
}

/// Helper: Get first model ID for a given CLI type
async fn get_first_model(client: &Client, cli_type_id: &str) -> String {
    let models_response = client
        .get(&format!("{}/cli_types/{}/models", API_BASE, cli_type_id))
        .send()
        .await
        .expect(&format!(
            "Failed to GET /cli_types/{}/models - server may not be running",
            cli_type_id
        ));

    assert_eq!(
        models_response.status(),
        200,
        "GET /cli_types/{}/models returned error status: {}",
        cli_type_id,
        models_response.status()
    );

    let models: Vec<serde_json::Value> = models_response
        .json()
        .await
        .expect(&format!(
            "Failed to parse models response for CLI type {}",
            cli_type_id
        ));

    assert!(
        !models.is_empty(),
        "No models found for CLI type {} - database may not be seeded",
        cli_type_id
    );

    models[0]["id"]
        .as_str()
        .expect("Model ID should be a string")
        .to_string()
}

#[tokio::test]
async fn test_cli_detection() {
    ensure_server_running().await;
    let client = client();

    // Test CLI detection endpoint
    let response = client
        .get(&format!("{}/cli_types/detect", API_BASE))
        .send()
        .await
        .expect("Failed to GET /cli_types/detect - server may not be running");

    assert_eq!(
        response.status(),
        200,
        "GET /cli_types/detect returned error status: {}",
        response.status()
    );

    let cli_types: Vec<serde_json::Value> = response
        .json()
        .await
        .expect("Failed to parse CLI detection response");

    // Should return at least some CLI types (even if not installed)
    assert!(
        !cli_types.is_empty(),
        "CLI detection should return at least one CLI type"
    );

    // Verify response structure
    for cli_type in cli_types {
        assert!(
            cli_type.get("cliTypeId").is_some(),
            "CLI type missing cliTypeId field"
        );
        assert!(
            cli_type.get("name").is_some(),
            "CLI type missing name field"
        );
        assert!(
            cli_type.get("displayName").is_some(),
            "CLI type missing displayName field"
        );
        assert!(
            cli_type.get("installed").is_some(),
            "CLI type missing installed field"
        );
        assert!(
            cli_type.get("installGuideUrl").is_some(),
            "CLI type missing installGuideUrl field"
        );
    }

    println!("✓ CLI detection test passed: {} CLI types checked", cli_types.len());
}

#[tokio::test]
async fn test_list_cli_types() {
    ensure_server_running().await;
    let client = client();

    // Test list CLI types endpoint
    let response = client
        .get(&format!("{}/cli_types", API_BASE))
        .send()
        .await
        .expect("Failed to GET /cli_types - server may not be running");

    assert_eq!(
        response.status(),
        200,
        "GET /cli_types returned error status: {}",
        response.status()
    );

    let cli_types: Vec<serde_json::Value> = response
        .json()
        .await
        .expect("Failed to parse CLI types response");

    // Should have at least the standard CLI types
    assert!(
        !cli_types.is_empty(),
        "Should have at least one CLI type - database may not be seeded"
    );

    // Verify response structure
    for cli_type in cli_types {
        assert!(
            cli_type.get("id").is_some(),
            "CLI type missing id field"
        );
        assert!(
            cli_type.get("name").is_some(),
            "CLI type missing name field"
        );
        assert!(
            cli_type.get("displayName").is_some(),
            "CLI type missing displayName field"
        );
        assert!(
            cli_type.get("detectCommand").is_some(),
            "CLI type missing detectCommand field"
        );
    }

    println!("✓ List CLI types test passed: {} CLI types found", cli_types.len());
}

#[tokio::test]
async fn test_list_models_for_cli() {
    ensure_server_running().await;
    let client = client();

    // Get a CLI type ID using helper
    let cli_type_id = get_first_cli_type(&client).await;

    // Test models for CLI type
    let response = client
        .get(&format!("{}/cli_types/{}/models", API_BASE, cli_type_id))
        .send()
        .await
        .expect(&format!(
            "Failed to GET /cli_types/{}/models - server may not be running",
            cli_type_id
        ));

    assert_eq!(
        response.status(),
        200,
        "GET /cli_types/{}/models returned error status: {}",
        cli_type_id,
        response.status()
    );

    let models: Vec<serde_json::Value> = response
        .json()
        .await
        .expect(&format!(
            "Failed to parse models response for CLI type {}",
            cli_type_id
        ));

    // Should return models (might be empty if none configured)
    println!(
        "✓ List models for CLI test passed: {} models for CLI type {}",
        models.len(),
        cli_type_id
    );

    // Verify structure if models exist
    for model in models {
        assert!(model.get("id").is_some(), "Model missing id field");
        assert!(
            model.get("cliTypeId").is_some(),
            "Model missing cliTypeId field"
        );
        assert!(model.get("name").is_some(), "Model missing name field");
        assert_eq!(
            model["cliTypeId"], cli_type_id,
            "Model's cliTypeId doesn't match requested CLI type"
        );
    }
}

#[tokio::test]
async fn test_list_command_presets() {
    ensure_server_running().await;
    let client = client();

    // Test list command presets endpoint
    let response = client
        .get(&format!("{}/workflows/presets/commands", API_BASE))
        .send()
        .await
        .expect("Failed to GET /workflows/presets/commands - server may not be running");

    assert_eq!(
        response.status(),
        200,
        "GET /workflows/presets/commands returned error status: {}",
        response.status()
    );

    let presets: Vec<serde_json::Value> = response
        .json()
        .await
        .expect("Failed to parse command presets response");

    // Should have system command presets
    assert!(
        !presets.is_empty(),
        "Should have at least one command preset - database may not be seeded"
    );

    // Verify response structure
    for preset in presets {
        assert!(preset.get("id").is_some(), "Preset missing id field");
        assert!(
            preset.get("command").is_some(),
            "Preset missing command field"
        );
        assert!(
            preset.get("description").is_some(),
            "Preset missing description field"
        );
        assert!(
            preset.get("isSystem").is_some(),
            "Preset missing isSystem field"
        );

        // Command should start with /
        let command = preset["command"]
            .as_str()
            .expect("Command should be a string");
        assert!(
            command.starts_with('/'),
            "Command '{}' should start with '/'",
            command
        );
    }

    println!("✓ List command presets test passed: {} presets found", presets.len());
}

#[tokio::test]
async fn test_workflow_lifecycle() {
    ensure_server_running().await;
    let client = client();
    let project_id = test_project_id();

    // Get CLI type and model IDs using helpers
    let cli_type_id = get_first_cli_type(&client).await;
    let model_id = get_first_model(&client, &cli_type_id).await;

    // Step 1: Create workflow
    let create_payload = json!({
        "projectId": project_id,
        "name": "E2E Test Workflow",
        "description": "Test workflow for lifecycle testing",
        "useSlashCommands": false,
        "mergeTerminalConfig": {
            "cliTypeId": cli_type_id,
            "modelConfigId": model_id
        },
        "targetBranch": "main"
    });

    let create_response = client
        .post(&format!("{}/workflows", API_BASE))
        .json(&create_payload)
        .send()
        .await
        .expect("Failed to POST /workflows - server may not be running");

    assert_eq!(
        create_response.status(),
        200,
        "POST /workflows returned error status: {}",
        create_response.status()
    );

    let workflow: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse workflow creation response");

    let workflow_id = workflow["workflow"]["id"]
        .as_str()
        .expect("Workflow should have an id field");

    println!("✓ Created workflow: {}", workflow_id);

    // Step 2: Get workflow details
    let get_response = client
        .get(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await
        .expect(&format!(
            "Failed to GET /workflows/{} - server may not be running",
            workflow_id
        ));

    assert_eq!(
        get_response.status(),
        200,
        "GET /workflows/{} returned error status: {}",
        workflow_id,
        get_response.status()
    );

    let retrieved: serde_json::Value = get_response
        .json()
        .await
        .expect(&format!(
            "Failed to parse workflow retrieval response for {}",
            workflow_id
        ));

    assert_eq!(
        retrieved["workflow"]["id"], workflow_id,
        "Retrieved workflow ID doesn't match"
    );
    assert_eq!(
        retrieved["workflow"]["name"], "E2E Test Workflow",
        "Retrieved workflow name doesn't match"
    );

    println!("✓ Retrieved workflow: {}", workflow_id);

    // Step 3: List workflows for project
    let list_response = client
        .get(&format!(
            "{}/workflows?projectId={}",
            API_BASE, project_id
        ))
        .send()
        .await
        .expect("Failed to GET /workflows?projectId=... - server may not be running");

    assert_eq!(
        list_response.status(),
        200,
        "GET /workflows?projectId=... returned error status: {}",
        list_response.status()
    );

    let workflows: Vec<serde_json::Value> = list_response
        .json()
        .await
        .expect("Failed to parse workflows list response");

    assert!(
        !workflows.is_empty(),
        "Should have at least one workflow in the list"
    );
    assert!(
        workflows.iter().any(|w| w["id"] == workflow_id),
        "Created workflow {} should be in the list",
        workflow_id
    );

    println!("✓ Listed workflows: {} workflows for project", workflows.len());

    // Step 4: Update workflow status
    let update_payload = json!({
        "status": "ready"
    });

    let update_response = client
        .put(&format!("{}/workflows/{}/status", API_BASE, workflow_id))
        .json(&update_payload)
        .send()
        .await
        .expect(&format!(
            "Failed to PUT /workflows/{}/status - server may not be running",
            workflow_id
        ));

    assert_eq!(
        update_response.status(),
        200,
        "PUT /workflows/{}/status returned error status: {}",
        workflow_id,
        update_response.status()
    );

    println!("✓ Updated workflow status to 'ready'");

    // Step 5: Verify status update
    let verify_response = client
        .get(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await
        .expect(&format!(
            "Failed to GET /workflows/{} for status verification",
            workflow_id
        ));

    let verify: serde_json::Value = verify_response
        .json()
        .await
        .expect("Failed to parse status verification response");

    assert_eq!(
        verify["workflow"]["status"], "ready",
        "Workflow status should be 'ready' after update"
    );

    // Step 6: Delete workflow
    let delete_response = client
        .delete(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await
        .expect(&format!(
            "Failed to DELETE /workflows/{} - server may not be running",
            workflow_id
        ));

    assert_eq!(
        delete_response.status(),
        200,
        "DELETE /workflows/{} returned error status: {}",
        workflow_id,
        delete_response.status()
    );

    println!("✓ Deleted workflow: {}", workflow_id);

    // Step 7: Verify deletion
    let verify_delete_response = client
        .get(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await
        .expect(&format!(
            "Failed to GET /workflows/{} for deletion verification",
            workflow_id
        ));

    assert_eq!(
        verify_delete_response.status(),
        200,
        "GET /workflows/{} after delete should return 200",
        workflow_id
    );

    let deleted: serde_json::Value = verify_delete_response
        .json()
        .await
        .expect("Failed to parse deletion verification response");

    // Workflow should not exist
    assert!(
        deleted["workflow"].is_null() || deleted["workflow"]["id"].is_null(),
        "Deleted workflow should be null or have null id"
    );

    println!("✓ Verified workflow deletion");
    println!("✓ Workflow lifecycle test completed successfully");
}

#[tokio::test]
async fn test_workflow_with_tasks() {
    ensure_server_running().await;
    let client = client();
    let project_id = test_project_id();

    // Get CLI type and model IDs using helpers
    let cli_type_id = get_first_cli_type(&client).await;
    let model_id = get_first_model(&client, &cli_type_id).await;

    // Get command presets
    let presets_response = client
        .get(&format!("{}/workflows/presets/commands", API_BASE))
        .send()
        .await
        .expect("Failed to GET /workflows/presets/commands - server may not be running");

    assert_eq!(
        presets_response.status(),
        200,
        "GET /workflows/presets/commands returned error status: {}",
        presets_response.status()
    );

    let presets: Vec<serde_json::Value> = presets_response
        .json()
        .await
        .expect("Failed to parse command presets response");

    assert!(
        !presets.is_empty(),
        "Need at least one command preset - database may not be seeded"
    );

    let preset_id = presets[0]["id"]
        .as_str()
        .expect("Command preset should have an id field");

    // Create workflow with slash commands and orchestrator
    let create_payload = json!({
        "projectId": project_id,
        "name": "Advanced Test Workflow",
        "description": "Test workflow with tasks and orchestrator",
        "useSlashCommands": true,
        "commandPresetIds": [preset_id],
        "orchestratorConfig": {
            "apiType": "anthropic",
            "baseUrl": "https://api.anthropic.com",
            "apiKey": get_test_api_key(),
            "model": "claude-sonnet-4-20250514"
        },
        "mergeTerminalConfig": {
            "cliTypeId": cli_type_id,
            "modelConfigId": model_id
        },
        "targetBranch": "develop"
    });

    let create_response = client
        .post(&format!("{}/workflows", API_BASE))
        .json(&create_payload)
        .send()
        .await
        .expect("Failed to POST /workflows - server may not be running");

    assert_eq!(
        create_response.status(),
        200,
        "POST /workflows returned error status: {}",
        create_response.status()
    );

    let workflow: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse workflow creation response");

    let workflow_id = workflow["workflow"]["id"]
        .as_str()
        .expect("Workflow should have an id field");

    println!("✓ Created advanced workflow: {}", workflow_id);

    // Verify orchestrator config
    assert_eq!(
        workflow["workflow"]["orchestratorEnabled"], true,
        "Orchestrator should be enabled"
    );
    assert_eq!(
        workflow["workflow"]["orchestratorApiType"], "anthropic",
        "Orchestrator API type should be 'anthropic'"
    );
    assert_eq!(
        workflow["workflow"]["orchestratorModel"], "claude-sonnet-4-20250514",
        "Orchestrator model should be 'claude-sonnet-4-20250514'"
    );

    // Verify slash commands
    assert!(
        workflow["commands"].is_array(),
        "Workflow should have commands array"
    );
    let commands = workflow["commands"]
        .as_array()
        .expect("Commands should be an array");
    assert!(
        !commands.is_empty(),
        "Workflow should have at least one command"
    );
    assert_eq!(
        commands[0]["preset"]["id"], preset_id,
        "First command's preset ID should match"
    );

    println!("✓ Verified orchestrator configuration");
    println!(
        "✓ Verified slash command associations: {} commands",
        commands.len()
    );

    // Verify target branch
    assert_eq!(
        workflow["workflow"]["targetBranch"], "develop",
        "Target branch should be 'develop'"
    );

    // Cleanup: delete the workflow
    let _ = client
        .delete(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await;

    println!("✓ Workflow with tasks test completed successfully");
}

#[tokio::test]
async fn test_workflow_error_handling() {
    ensure_server_running().await;
    let client = client();
    let project_id = test_project_id();

    // Test 1: Create workflow with invalid CLI type ID
    let invalid_payload = json!({
        "projectId": project_id,
        "name": "Invalid Workflow",
        "description": "Test with invalid CLI type",
        "useSlashCommands": false,
        "mergeTerminalConfig": {
            "cliTypeId": "invalid-cli-type-id",
            "modelConfigId": "invalid-model-id"
        },
        "targetBranch": "main"
    });

    let response = client
        .post(&format!("{}/workflows", API_BASE))
        .json(&invalid_payload)
        .send()
        .await
        .expect("Failed to POST /workflows - server may not be running");

    // Should return error (400 or 500 depending on validation)
    assert!(
        response.status() == 400 || response.status() == 500,
        "Should reject invalid CLI type: got status {}",
        response.status()
    );

    println!("✓ Correctly rejected invalid CLI type");

    // Test 2: Try to get non-existent workflow
    let fake_id = Uuid::new_v4().to_string();
    let response = client
        .get(&format!("{}/workflows/{}", API_BASE, fake_id))
        .send()
        .await
        .expect(&format!(
            "Failed to GET /workflows/{} - server may not be running",
            fake_id
        ));

    // Should return not found or success with null
    assert!(
        response.status() == 404 || response.status() == 200,
        "Should handle non-existent workflow gracefully, got status {}",
        response.status()
    );

    if response.status() == 200 {
        let result: serde_json::Value = response
            .json()
            .await
            .expect("Failed to parse non-existent workflow response");

        assert!(
            result["workflow"].is_null() || result["workflow"]["id"].is_null(),
            "Non-existent workflow should be null"
        );
    }

    println!("✓ Correctly handled non-existent workflow");

    // Test 3: Try to update status of non-existent workflow
    let update_payload = json!({
        "status": "ready"
    });

    let response = client
        .put(&format!("{}/workflows/{}/status", API_BASE, fake_id))
        .json(&update_payload)
        .send()
        .await
        .expect(&format!(
            "Failed to PUT /workflows/{}/status - server may not be running",
            fake_id
        ));

    // Should return error
    assert!(
        response.status() == 400 || response.status() == 404,
        "Should reject status update for non-existent workflow: got status {}",
        response.status()
    );

    println!("✓ Correctly rejected status update for non-existent workflow");

    // Test 4: Try to delete non-existent workflow
    let response = client
        .delete(&format!("{}/workflows/{}", API_BASE, fake_id))
        .send()
        .await
        .expect(&format!(
            "Failed to DELETE /workflows/{} - server may not be running",
            fake_id
        ));

    // Should succeed even if workflow doesn't exist (idempotent)
    // or return 404
    assert!(
        response.status() == 200 || response.status() == 404,
        "Should handle delete of non-existent workflow: got status {}",
        response.status()
    );

    println!("✓ Handled delete of non-existent workflow");

    // Test 5: Create valid workflow, then try invalid status update
    let cli_type_id = get_first_cli_type(&client).await;
    let model_id = get_first_model(&client, &cli_type_id).await;

    let create_payload = json!({
        "projectId": project_id,
        "name": "Status Test Workflow",
        "useSlashCommands": false,
        "mergeTerminalConfig": {
            "cliTypeId": cli_type_id,
            "modelConfigId": model_id
        }
    });

    let create_response = client
        .post(&format!("{}/workflows", API_BASE))
        .json(&create_payload)
        .send()
        .await
        .expect("Failed to POST /workflows - server may not be running");

    if create_response.status() == 200 {
        let workflow: serde_json::Value = create_response
            .json()
            .await
            .expect("Failed to parse workflow creation response");

        let workflow_id = workflow["workflow"]["id"]
            .as_str()
            .expect("Workflow should have an id field");

        // Try invalid status
        let invalid_status = json!({
            "status": "invalid-status-value"
        });

        let response = client
            .put(&format!("{}/workflows/{}/status", API_BASE, workflow_id))
            .json(&invalid_status)
            .send()
            .await
            .expect(&format!(
                "Failed to PUT /workflows/{}/status - server may not be running",
                workflow_id
            ));

        // Should reject invalid status
        assert!(
            response.status() == 400 || response.status() == 422,
            "Should reject invalid status value: got status {}",
            response.status()
        );

        println!("✓ Correctly rejected invalid status value");

        // Cleanup
        let _ = client
            .delete(&format!("{}/workflows/{}", API_BASE, workflow_id))
            .send()
            .await;
    }

    println!("✓ Workflow error handling test completed successfully");
}
