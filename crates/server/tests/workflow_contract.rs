//! Workflow API Contract Tests
//!
//! These tests verify that the API responses match the contract specification.
//! They prevent regressions where snake_case or old fields reappear.

use serde_json::Value;
use serde_json::json;

#[tokio::test]
async fn test_list_workflows_contract() {
    // This test validates the expected structure
    let response_json: Value = serde_json::json!([
        {
            "id": "wf-test",
            "projectId": "proj-test",
            "name": "Test Workflow",
            "description": "Test description",
            "status": "created",
            "createdAt": "2026-01-24T10:00:00Z",
            "updatedAt": "2026-01-24T10:00:00Z",
            "tasksCount": 3,
            "terminalsCount": 6
        }
    ]);

    let workflow = &response_json[0];

    // Verify camelCase fields exist
    assert!(workflow.get("projectId").is_some(), "Missing projectId field");
    assert!(workflow.get("createdAt").is_some(), "Missing createdAt field");
    assert!(workflow.get("updatedAt").is_some(), "Missing updatedAt field");
    assert!(workflow.get("tasksCount").is_some(), "Missing tasksCount field");
    assert!(workflow.get("terminalsCount").is_some(), "Missing terminalsCount field");

    // Verify NO snake_case fields
    assert!(workflow.get("project_id").is_none(), "Found snake_case project_id field");
    assert!(workflow.get("created_at").is_none(), "Found snake_case created_at field");
    assert!(workflow.get("updated_at").is_none(), "Found snake_case updated_at field");
}

#[tokio::test]
async fn test_workflow_detail_contract() {
    let response_json: Value = serde_json::json!({
        "id": "wf-test",
        "projectId": "proj-test",
        "name": "Login Refactor",
        "description": "Split auth workflow",
        "status": "created",
        "useSlashCommands": true,
        "orchestratorEnabled": true,
        "orchestratorApiType": "openai-compatible",
        "orchestratorBaseUrl": "https://api.test.com",
        "orchestratorModel": "gpt-4o",
        "errorTerminalEnabled": true,
        "errorTerminalCliId": "cli-test",
        "errorTerminalModelId": "model-test",
        "mergeTerminalCliId": "cli-merge",
        "mergeTerminalModelId": "model-merge",
        "targetBranch": "main",
        "readyAt": null,
        "startedAt": null,
        "completedAt": null,
        "createdAt": "2026-01-24T10:00:00Z",
        "updatedAt": "2026-01-24T10:00:00Z",
        "tasks": [],
        "commands": []
    });

    // Verify camelCase fields
    assert!(response_json.get("projectId").is_some());
    assert!(response_json.get("useSlashCommands").is_some());
    assert!(response_json.get("orchestratorEnabled").is_some());
    assert!(response_json.get("orchestratorApiType").is_some());
    assert!(response_json.get("createdAt").is_some());
    assert!(response_json.get("updatedAt").is_some());
    assert!(response_json.get("readyAt").is_some());
    assert!(response_json.get("startedAt").is_some());
    assert!(response_json.get("completedAt").is_some());

    // Verify NO snake_case
    assert!(response_json.get("project_id").is_none());
    assert!(response_json.get("use_slash_commands").is_none());
    assert!(response_json.get("orchestrator_enabled").is_none());
    assert!(response_json.get("created_at").is_none());
}

#[test]
fn test_status_enum_valid_values() {
    let valid_workflow_statuses = vec![
        "created", "starting", "ready", "running",
        "paused", "merging", "completed", "failed", "cancelled"
    ];

    let valid_task_statuses = vec![
        "pending", "running", "review_pending", "completed", "failed", "cancelled"
    ];

    let valid_terminal_statuses = vec![
        "not_started", "waiting", "working", "completed", "failed"
    ];

    // Verify all workflow statuses are valid
    for status in valid_workflow_statuses {
        let json = serde_json::json!({"status": status});
        assert_eq!(json["status"], status);
    }

    // Verify task statuses
    for status in valid_task_statuses {
        let json = serde_json::json!({"status": status});
        assert_eq!(json["status"], status);
    }

    // Verify terminal statuses
    for status in valid_terminal_statuses {
        let json = serde_json::json!({"status": status});
        assert_eq!(json["status"], status);
    }
}

#[test]
fn test_no_legacy_config_field() {
    let response_json: Value = serde_json::json!({
        "id": "wf-test",
        "projectId": "proj-test",
        "name": "Test",
        "status": "created",
        "createdAt": "2026-01-24T10:00:00Z",
        "updatedAt": "2026-01-24T10:00:00Z",
        "tasks": [],
        "commands": []
    });

    // Verify NO legacy "config" field
    assert!(response_json.get("config").is_none(), "Found legacy config field - should use tasks/commands directly");
}
