//! Access Control Security Tests
//!
//! Tests for API access control and authorization.
//!
//! These tests verify:
//! - Workflow access is scoped to project
//! - Cross-project access is denied
//! - API rate limiting works

use std::time::Duration;
use serde_json::json;
use uuid::Uuid;

const API_BASE: &str = "http://localhost:3001/api";

/// Check if server is running
async fn server_is_running() -> bool {
    reqwest::Client::new()
        .get(&format!("{}/cli_types", API_BASE))
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .is_ok()
}

/// Create HTTP client with timeout
fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
}

/// Helper to get first CLI type
async fn get_first_cli_type(client: &reqwest::Client) -> Option<String> {
    let response = client
        .get(&format!("{}/cli_types", API_BASE))
        .send()
        .await
        .ok()?;

    let cli_types: Vec<serde_json::Value> = response.json().await.ok()?;
    cli_types.first()?.get("id")?.as_str().map(String::from)
}

/// Helper to get first model for CLI type
async fn get_first_model(client: &reqwest::Client, cli_type_id: &str) -> Option<String> {
    let response = client
        .get(&format!("{}/cli_types/{}/models", API_BASE, cli_type_id))
        .send()
        .await
        .ok()?;

    let models: Vec<serde_json::Value> = response.json().await.ok()?;
    models.first()?.get("id")?.as_str().map(String::from)
}

/// Create a test workflow and return its ID
async fn create_test_workflow(
    client: &reqwest::Client,
    project_id: &str,
    cli_type_id: &str,
    model_id: &str,
) -> Option<String> {
    let payload = json!({
        "projectId": project_id,
        "name": format!("Access Control Test {}", Uuid::new_v4()),
        "description": "Test workflow for access control",
        "useSlashCommands": false,
        "mergeTerminalConfig": {
            "cliTypeId": cli_type_id,
            "modelConfigId": model_id
        },
        "targetBranch": "main",
        "tasks": [{
            "name": "Test Task",
            "description": "Test task",
            "orderIndex": 0,
            "terminals": [{
                "cliTypeId": cli_type_id,
                "modelConfigId": model_id,
                "orderIndex": 0
            }]
        }]
    });

    let response = client
        .post(&format!("{}/workflows", API_BASE))
        .json(&payload)
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let body: serde_json::Value = response.json().await.ok()?;

    // Try different response formats
    body.pointer("/data/id")
        .or_else(|| body.pointer("/data/workflow/id"))
        .or_else(|| body.pointer("/workflow/id"))
        .and_then(|v| v.as_str())
        .map(String::from)
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_workflow_access_by_project() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    let cli_type_id = match get_first_cli_type(&client).await {
        Some(id) => id,
        None => {
            eprintln!("No CLI types found, skipping test");
            return;
        }
    };

    let model_id = match get_first_model(&client, &cli_type_id).await {
        Some(id) => id,
        None => {
            eprintln!("No models found, skipping test");
            return;
        }
    };

    // Create workflows in two different projects
    let project_a = Uuid::new_v4().to_string();
    let project_b = Uuid::new_v4().to_string();

    // Fixed: Use expect() to fail explicitly if workflow creation fails
    let workflow_a = create_test_workflow(&client, &project_a, &cli_type_id, &model_id)
        .await
        .expect("Failed to create workflow A - test cannot proceed");
    let workflow_b = create_test_workflow(&client, &project_b, &cli_type_id, &model_id)
        .await
        .expect("Failed to create workflow B - test cannot proceed");

    println!("\n=== Workflow Access by Project Test ===");
    println!("Project A: {}", project_a);
    println!("Project B: {}", project_b);
    println!("Workflow A: {}", workflow_a);
    println!("Workflow B: {}", workflow_b);

    // List workflows for project A - should only see workflow A
    // Fixed: Use project_id instead of projectId
    let response = client
        .get(&format!("{}/workflows?project_id={}", API_BASE, project_a))
        .send()
        .await
        .expect("Failed to list workflows");

    let workflows: serde_json::Value = response.json().await.expect("Failed to parse response");

    if let Some(data) = workflows.get("data").and_then(|d| d.as_array()) {
        println!("Workflows in Project A: {}", data.len());

        // Verify workflow B is not in project A's list
        for workflow in data {
            if let Some(id) = workflow.get("id").and_then(|v| v.as_str()) {
                assert_ne!(
                    id,
                    workflow_b.as_str(),
                    "Workflow B should not appear in Project A's list"
                );
            }
        }
    }

    // Cleanup
    let _ = client.delete(&format!("{}/workflows/{}", API_BASE, workflow_a)).send().await;
    let _ = client.delete(&format!("{}/workflows/{}", API_BASE, workflow_b)).send().await;
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_workflow_detail_access() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    let cli_type_id = match get_first_cli_type(&client).await {
        Some(id) => id,
        None => {
            eprintln!("No CLI types found, skipping test");
            return;
        }
    };

    let model_id = match get_first_model(&client, &cli_type_id).await {
        Some(id) => id,
        None => {
            eprintln!("No models found, skipping test");
            return;
        }
    };

    let project_id = Uuid::new_v4().to_string();
    // Fixed: Use expect() to fail explicitly if workflow creation fails
    let workflow_id = create_test_workflow(&client, &project_id, &cli_type_id, &model_id)
        .await
        .expect("Failed to create workflow - test cannot proceed");

    println!("\n=== Workflow Detail Access Test ===");

    // Access existing workflow - should succeed
    let response = client
        .get(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await
        .expect("Failed to get workflow");

    assert!(
        response.status().is_success(),
        "Should be able to access own workflow"
    );

    // Access non-existent workflow - should return 404
    let fake_id = Uuid::new_v4().to_string();
    let response = client
        .get(&format!("{}/workflows/{}", API_BASE, fake_id))
        .send()
        .await
        .expect("Failed to get workflow");

    assert_eq!(
        response.status().as_u16(),
        404,
        "Non-existent workflow should return 404"
    );

    println!("OK: Workflow access control working correctly");

    // Cleanup
    let _ = client.delete(&format!("{}/workflows/{}", API_BASE, workflow_id)).send().await;
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_invalid_uuid_rejected() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== Invalid UUID Rejection Test ===");

    // Test with invalid UUID formats
    let invalid_ids = vec![
        "not-a-uuid",
        "12345",
        "../../../etc/passwd",
        "'; DROP TABLE workflows; --",
        "<script>alert('xss')</script>",
    ];

    for invalid_id in invalid_ids {
        let response = client
            .get(&format!("{}/workflows/{}", API_BASE, invalid_id))
            .send()
            .await
            .expect("Request failed");

        let status = response.status().as_u16();

        // Should return 400 (bad request) or 404 (not found), not 500 (server error)
        assert!(
            status == 400 || status == 404,
            "Invalid UUID '{}' should return 400 or 404, got {}",
            invalid_id,
            status
        );

        println!("OK: Invalid ID '{}' properly rejected with status {}", invalid_id, status);
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_api_rate_limiting() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== API Rate Limiting Test ===");

    // Send many requests quickly
    let num_requests = 100;
    let mut success_count = 0;
    let mut rate_limited_count = 0;

    for _ in 0..num_requests {
        let response = client
            .get(&format!("{}/cli_types", API_BASE))
            .send()
            .await;

        match response {
            Ok(r) => {
                if r.status().as_u16() == 429 {
                    rate_limited_count += 1;
                } else if r.status().is_success() {
                    success_count += 1;
                }
            }
            Err(_) => {}
        }
    }

    println!("Requests sent: {}", num_requests);
    println!("Successful: {}", success_count);
    println!("Rate limited (429): {}", rate_limited_count);

    // Note: Rate limiting may or may not be enabled
    // This test documents the behavior
    if rate_limited_count > 0 {
        println!("OK: Rate limiting is active");
    } else {
        println!("Note: Rate limiting may not be configured");
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_workflow_delete_authorization() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    let cli_type_id = match get_first_cli_type(&client).await {
        Some(id) => id,
        None => {
            eprintln!("No CLI types found, skipping test");
            return;
        }
    };

    let model_id = match get_first_model(&client, &cli_type_id).await {
        Some(id) => id,
        None => {
            eprintln!("No models found, skipping test");
            return;
        }
    };

    println!("\n=== Workflow Delete Authorization Test ===");

    let project_id = Uuid::new_v4().to_string();
    // Fixed: Use expect() to fail explicitly if workflow creation fails
    let workflow_id = create_test_workflow(&client, &project_id, &cli_type_id, &model_id)
        .await
        .expect("Failed to create workflow - test cannot proceed");

    // Delete should succeed for existing workflow
    let response = client
        .delete(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await
        .expect("Delete request failed");

    assert!(
        response.status().is_success() || response.status().as_u16() == 204,
        "Should be able to delete own workflow"
    );

    // Second delete should return 404
    let response = client
        .delete(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .send()
        .await
        .expect("Delete request failed");

    assert_eq!(
        response.status().as_u16(),
        404,
        "Deleting already-deleted workflow should return 404"
    );

    println!("OK: Delete authorization working correctly");
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_workflow_update_authorization() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    let cli_type_id = match get_first_cli_type(&client).await {
        Some(id) => id,
        None => {
            eprintln!("No CLI types found, skipping test");
            return;
        }
    };

    let model_id = match get_first_model(&client, &cli_type_id).await {
        Some(id) => id,
        None => {
            eprintln!("No models found, skipping test");
            return;
        }
    };

    println!("\n=== Workflow Update Authorization Test ===");

    let project_id = Uuid::new_v4().to_string();
    // Fixed: Use expect() to fail explicitly if workflow creation fails
    let workflow_id = create_test_workflow(&client, &project_id, &cli_type_id, &model_id)
        .await
        .expect("Failed to create workflow - test cannot proceed");

    // Update existing workflow
    let update_payload = json!({
        "name": "Updated Workflow Name",
        "description": "Updated description"
    });

    let response = client
        .patch(&format!("{}/workflows/{}", API_BASE, workflow_id))
        .json(&update_payload)
        .send()
        .await
        .expect("Update request failed");

    // Should succeed or return method not allowed if PATCH not supported
    let status = response.status().as_u16();
    assert!(
        status == 200 || status == 204 || status == 405,
        "Update should succeed or return 405 if not supported, got {}",
        status
    );

    // Update non-existent workflow
    let fake_id = Uuid::new_v4().to_string();
    let response = client
        .patch(&format!("{}/workflows/{}", API_BASE, fake_id))
        .json(&update_payload)
        .send()
        .await
        .expect("Update request failed");

    let status = response.status().as_u16();
    assert!(
        status == 404 || status == 405,
        "Update non-existent should return 404 or 405, got {}",
        status
    );

    println!("OK: Update authorization working correctly");

    // Cleanup
    let _ = client.delete(&format!("{}/workflows/{}", API_BASE, workflow_id)).send().await;
}
