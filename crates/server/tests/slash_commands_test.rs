//! Integration tests for slash commands API endpoints
//!
//! These tests verify the full slash command preset lifecycle including:
//! - Creating command presets
//! - Listing command presets
//! - Updating command presets
//! - Deleting command presets
//! - Input validation (command must start with /, command must be unique, description required)

use server::DeploymentImpl;
use server::routes::subscription_hub::SubscriptionHub;
use db::models::SlashCommandPreset;
use uuid::Uuid;
use serde_json::json;
use chrono::Utc;
use std::sync::Arc;

/// Helper: Create a test subscription hub
fn create_test_hub() -> server::routes::SharedSubscriptionHub {
    Arc::new(SubscriptionHub::default())
}

/// Helper: Setup test environment
async fn setup_test() -> DeploymentImpl {
    let deployment = DeploymentImpl::new().await
        .expect("Failed to create deployment");

    deployment
}

#[tokio::test]
async fn test_list_command_presets() {
    let deployment = setup_test().await;

    // List all command presets (should include system presets)
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment, create_test_hub());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/workflows/presets/commands")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // Parse response body
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // Should be a successful response with data array
    assert_eq!(value["success"], true);
    assert!(value["data"].is_array());

    // Should have at least 3 system presets (from migration)
    let presets = value["data"].as_array().unwrap();
    assert!(presets.len() >= 3, "Should have at least 3 system presets");
}

#[tokio::test]
async fn test_create_command_preset_success() {
    let deployment = setup_test().await;

    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment, create_test_hub());

    let new_command = json!({
        "command": "/test-command",
        "description": "Test command description",
        "promptTemplate": "Test template with {{variable}}"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workflows/presets/commands")
                .header("content-type", "application/json")
                .body(Body::from(new_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    // Parse response
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(value["success"], true);
    assert!(value["data"]["id"].is_string());
    assert_eq!(value["data"]["command"], "/test-command");
    assert_eq!(value["data"]["description"], "Test command description");
    assert_eq!(value["data"]["promptTemplate"], "Test template with {{variable}}");
    assert_eq!(value["data"]["isSystem"], false);
}

#[tokio::test]
async fn test_create_command_preset_missing_leading_slash() {
    let deployment = setup_test().await;

    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment, create_test_hub());

    let new_command = json!({
        "command": "test-command",  // Missing leading slash
        "description": "Test command description"
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workflows/presets/commands")
                .header("content-type", "application/json")
                .body(Body::from(new_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    // Parse response
    let body = hyper::body::to_bytes(response.into_body()).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(value["success"], false);
    assert!(value["error"].is_string());
}

#[tokio::test]
async fn test_create_command_preset_duplicate_command() {
    let deployment = setup_test().await;

    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment, create_test_hub());

    let new_command = json!({
        "command": "/duplicate-test",
        "description": "Test command description"
    });

    // Create first command - should succeed
    let response1 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workflows/presets/commands")
                .header("content-type", "application/json")
                .body(Body::from(new_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response1.status(), StatusCode::OK);

    // Try to create duplicate - should fail
    let response2 = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workflows/presets/commands")
                .header("content-type", "application/json")
                .body(Body::from(new_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::CONFLICT);
}

#[tokio::test]
async fn test_create_command_preset_missing_description() {
    let deployment = setup_test().await;

    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment, create_test_hub());

    let new_command = json!({
        "command": "/test-command"
        // Missing description
    });

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workflows/presets/commands")
                .header("content-type", "application/json")
                .body(Body::from(new_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_update_command_preset() {
    let deployment = setup_test().await;

    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment, create_test_hub());

    // First create a command
    let new_command = json!({
        "command": "/update-test",
        "description": "Original description",
        "promptTemplate": "Original template"
    });

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workflows/presets/commands")
                .header("content-type", "application/json")
                .body(Body::from(new_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = hyper::body::to_bytes(create_response.into_body()).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let command_id = value["data"]["id"].as_str().unwrap();

    // Update the command
    let update_command = json!({
        "description": "Updated description",
        "promptTemplate": "Updated template"
    });

    let update_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(&format!("/api/workflows/presets/commands/{}", command_id))
                .header("content-type", "application/json")
                .body(Body::from(update_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(update_response.status(), StatusCode::OK);

    // Parse response
    let body = hyper::body::to_bytes(update_response.into_body()).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(value["success"], true);
    assert_eq!(value["data"]["id"], command_id);
    assert_eq!(value["data"]["command"], "/update-test");
    assert_eq!(value["data"]["description"], "Updated description");
    assert_eq!(value["data"]["promptTemplate"], "Updated template");
}

#[tokio::test]
async fn test_delete_command_preset() {
    let deployment = setup_test().await;

    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    let app = server::routes::router(deployment, create_test_hub());

    // First create a command
    let new_command = json!({
        "command": "/delete-test",
        "description": "Command to be deleted"
    });

    let create_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/workflows/presets/commands")
                .header("content-type", "application/json")
                .body(Body::from(new_command.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    let body = hyper::body::to_bytes(create_response.into_body()).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let command_id = value["data"]["id"].as_str().unwrap();

    // Delete the command
    let delete_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri(&format!("/api/workflows/presets/commands/{}", command_id))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(delete_response.status(), StatusCode::OK);

    // Verify it's deleted by trying to list
    let list_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/workflows/presets/commands")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let body = hyper::body::to_bytes(list_response.into_body()).await.unwrap();
    let value: serde_json::Value = serde_json::from_slice(&body).unwrap();

    // The deleted command should not be in the list
    let presets = value["data"].as_array().unwrap();
    let found = presets.iter().any(|p| p["id"].as_str().unwrap() == command_id);
    assert!(!found, "Deleted command should not be in list");
}
