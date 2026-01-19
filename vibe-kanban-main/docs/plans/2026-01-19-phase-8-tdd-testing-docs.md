# Phase 8: Integration Testing & Documentation - TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement end-to-end tests, performance optimizations, and user documentation for the GitCortex workflow orchestration system.

**Architecture:**
- E2E tests using `tokio::test` with `reqwest` client against running server
- Performance optimizations through database indexing and connection pooling
- Comprehensive user documentation with examples

**Tech Stack:** Rust (tokio, reqwest, sqlx), SQLite, Markdown

**Context:** This plan assumes the engineer is working in the worktree at `.worktrees/phase-8-testing/vibe-kanban-main/`. All file paths are relative to that directory. The server runs on `http://localhost:3001` by default in dev mode.

---

## Task 8.1: End-to-End Testing (Workflow Lifecycle)

**Files:**
- Create: `tests/e2e/workflow_test.rs`
- Modify: `Cargo.toml` (add e2e test configuration)

**Prerequisites:**
- Server must be running on `http://localhost:3001`
- Database initialized with workflow tables
- CLI types and model configs seeded

---

### Step 8.1.1: Add e2e test dependency to workspace Cargo.toml

**File:** `Cargo.toml` (workspace root)

**Add to `[workspace.dependencies]` section:**

```toml
[workspace.dependencies]
# ... existing dependencies ...
reqwest = { version = "0.12", default-features = false, features = ["json", "stream", "rustls-tls-webpiki-roots-no-provider"] }
```

**Verification:** Run `cargo check --workspace` - should compile without errors.

---

### Step 8.1.2: Create tests directory structure

**Run:**
```bash
mkdir -p tests/e2e
```

**Expected:** Directory `tests/e2e/` created.

---

### Step 8.1.3: Create workflow_test.rs with workflow lifecycle test

**File:** `tests/e2e/workflow_test.rs`

**Write the following code:**

```rust
//! GitCortex Workflow End-to-End Tests
//!
//! These tests verify the complete workflow lifecycle:
//! 1. CLI type detection
//! 2. Model listing
//! 3. Workflow creation
//! 4. Workflow retrieval
//! 5. Workflow deletion
//!
//! Prerequisites:
//! - Server running on http://localhost:3001
//! - Database initialized with workflow tables

use reqwest::Client;
use serde_json::json;
use std::time::Duration;

const BASE_URL: &str = "http://localhost:3001";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// Test helper: Create HTTP client with timeout
fn create_client() -> Client {
    Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .expect("Failed to create HTTP client")
}

/// Test helper: Get auth token if needed
async fn get_auth_token(client: &Client) -> Option<String> {
    // For now, returns None (public API)
    // TODO: Add auth when implemented
    None
}

// ============================================================================
// Test 1: CLI Detection
// ============================================================================

#[tokio::test]
async fn test_cli_detection() {
    let client = create_client();

    // Call GET /api/cli_types/detect
    let response = client
        .get(format!("{}/api/cli_types/detect", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    // Verify success
    assert!(
        response.status().is_success(),
        "CLI detection failed: status {}",
        response.status()
    );

    // Parse response
    let detection: Vec<serde_json::Value> = response
        .json()
        .await
        .expect("Failed to parse JSON response");

    // Verify structure
    assert!(!detection.is_empty(), "No CLI types returned");

    for cli in &detection {
        assert!(
            cli.get("cli_type_id").is_some(),
            "Missing cli_type_id in detection result"
        );
        assert!(
            cli.get("installed").is_some(),
            "Missing installed flag in detection result"
        );
        assert!(
            cli.get("name").is_some(),
            "Missing name in detection result"
        );
    }

    println!("CLI Detection Results:");
    for cli in &detection {
        println!(
            "  - {}: installed={}",
            cli["name"].as_str().unwrap_or("unknown"),
            cli["installed"].as_bool().unwrap_or(false)
        );
    }
}

// ============================================================================
// Test 2: List CLI Types
// ============================================================================

#[tokio::test]
async fn test_list_cli_types() {
    let client = create_client();

    // Call GET /api/cli_types
    let response = client
        .get(format!("{}/api/cli_types", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    // Verify success
    assert!(
        response.status().is_success(),
        "List CLI types failed: status {}",
        response.status()
    );

    // Parse response
    let cli_types: Vec<serde_json::Value> = response
        .json()
        .await
        .expect("Failed to parse JSON response");

    // Verify we have CLI types
    assert!(!cli_types.is_empty(), "No CLI types found");

    // Verify Claude CLI exists
    let claude_cli = cli_types
        .iter()
        .find(|c| c["name"] == "claude-code")
        .expect("Claude CLI not found in list");

    assert_eq!(
        claude_cli["display_name"],
        "Claude Code",
        "Claude display name mismatch"
    );

    println!("Found {} CLI types", cli_types.len());
}

// ============================================================================
// Test 3: List Models for CLI
// ============================================================================

#[tokio::test]
async fn test_list_models_for_cli() {
    let client = create_client();

    // First, get CLI types to find Claude
    let cli_response = client
        .get(format!("{}/api/cli_types", BASE_URL))
        .send()
        .await
        .expect("Failed to get CLI types");

    let cli_types: Vec<serde_json::Value> = cli_response
        .json()
        .await
        .expect("Failed to parse CLI types");

    let claude_cli = cli_types
        .iter()
        .find(|c| c["name"] == "claude-code")
        .expect("Claude CLI not found");

    let cli_id = claude_cli["id"].as_str().expect("Missing CLI ID");

    // Get models for Claude
    let models_response = client
        .get(format!("{}/api/cli_types/{}/models", BASE_URL, cli_id))
        .send()
        .await
        .expect("Failed to get models");

    assert!(
        models_response.status().is_success(),
        "Get models failed: status {}",
        models_response.status()
    );

    let models: Vec<serde_json::Value> = models_response
        .json()
        .await
        .expect("Failed to parse models");

    assert!(!models.is_empty(), "No models found for Claude CLI");

    println!("Found {} models for Claude CLI", models.len());
    for model in &models {
        println!(
            "  - {} ({})",
            model["display_name"].as_str().unwrap_or("unknown"),
            model["name"].as_str().unwrap_or("unknown")
        );
    }
}

// ============================================================================
// Test 4: List Slash Command Presets
// ============================================================================

#[tokio::test]
async fn test_list_command_presets() {
    let client = create_client();

    // Call GET /api/workflows/presets/commands
    let response = client
        .get(format!("{}/api/workflows/presets/commands", BASE_URL))
        .send()
        .await
        .expect("Failed to send request");

    // Verify success
    assert!(
        response.status().is_success(),
        "List command presets failed: status {}",
        response.status()
    );

    // Parse response
    let presets: Vec<serde_json::Value> = response
        .json()
        .await
        .expect("Failed to parse JSON response");

    // Verify we have presets
    assert!(!presets.is_empty(), "No command presets found");

    // Verify structure
    for preset in &presets {
        assert!(
            preset.get("command").is_some(),
            "Missing command in preset"
        );
        assert!(
            preset.get("description").is_some(),
            "Missing description in preset"
        );
    }

    println!("Found {} slash command presets", presets.len());
    for preset in &presets {
        println!(
            "  - {}: {}",
            preset["command"].as_str().unwrap_or("unknown"),
            preset["description"].as_str().unwrap_or("no description")
        );
    }
}

// ============================================================================
// Test 5: Workflow Lifecycle (Create, Read, Delete)
// ============================================================================

#[tokio::test]
async fn test_workflow_lifecycle() {
    let client = create_client();

    // Step 1: Get CLI types and find Claude
    let cli_response = client
        .get(format!("{}/api/cli_types", BASE_URL))
        .send()
        .await
        .expect("Failed to get CLI types");

    let cli_types: Vec<serde_json::Value> = cli_response
        .json()
        .await
        .expect("Failed to parse CLI types");

    let claude_cli = cli_types
        .iter()
        .find(|c| c["name"] == "claude-code")
        .expect("Claude CLI not found");

    let cli_id = claude_cli["id"].as_str().expect("Missing CLI ID");

    // Step 2: Get models for Claude
    let models_response = client
        .get(format!("{}/api/cli_types/{}/models", BASE_URL, cli_id))
        .send()
        .await
        .expect("Failed to get models");

    let models: Vec<serde_json::Value> = models_response
        .json()
        .await
        .expect("Failed to parse models");

    let model_id = models[0]["id"].as_str().expect("Missing model ID");

    // Step 3: Create workflow
    let workflow_req = json!({
        "project_id": format!("test-project-{}", uuid::Uuid::new_v4()),
        "name": "E2E Test Workflow",
        "description": "Automated end-to-end test workflow",
        "use_slash_commands": false,
        "merge_terminal_config": {
            "cli_type_id": cli_id,
            "model_config_id": model_id
        },
        "target_branch": "main"
    });

    let create_response = client
        .post(format!("{}/api/workflows", BASE_URL))
        .json(&workflow_req)
        .send()
        .await
        .expect("Failed to create workflow");

    assert!(
        create_response.status().is_success(),
        "Create workflow failed: status {}",
        create_response.status()
    );

    let create_result: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse create response");

    let workflow = &create_result["data"]["workflow"];
    let workflow_id = workflow["id"].as_str().expect("Missing workflow ID");

    println!("Created workflow: {}", workflow_id);

    // Step 4: Get workflow details
    let get_response = client
        .get(format!("{}/api/workflows/{}", BASE_URL, workflow_id))
        .send()
        .await
        .expect("Failed to get workflow");

    assert!(
        get_response.status().is_success(),
        "Get workflow failed: status {}",
        get_response.status()
    );

    let get_result: serde_json::Value = get_response
        .json()
        .await
        .expect("Failed to parse get response");

    assert_eq!(
        get_result["data"]["workflow"]["id"],
        workflow["id"],
        "Workflow ID mismatch"
    );

    println!("Retrieved workflow: {}", workflow_id);

    // Step 5: List workflows for project
    let list_response = client
        .get(format!(
            "{}/api/workflows?project_id={}",
            BASE_URL,
            workflow["project_id"].as_str().unwrap()
        ))
        .send()
        .await
        .expect("Failed to list workflows");

    assert!(
        list_response.status().is_success(),
        "List workflows failed: status {}",
        list_response.status()
    );

    let list_result: serde_json::Value = list_response
        .json()
        .await
        .expect("Failed to parse list response");

    let workflows = list_result["data"].as_array().expect("Missing workflows array");
    assert!(!workflows.is_empty(), "No workflows found");

    println!("Found {} workflows for project", workflows.len());

    // Step 6: Update workflow status
    let update_req = json!({
        "status": "ready"
    });

    let update_response = client
        .put(format!("{}/api/workflows/{}/status", BASE_URL, workflow_id))
        .json(&update_req)
        .send()
        .await
        .expect("Failed to update workflow status");

    assert!(
        update_response.status().is_success(),
        "Update status failed: status {}",
        update_response.status()
    );

    println!("Updated workflow status to 'ready'");

    // Step 7: Delete workflow
    let delete_response = client
        .delete(format!("{}/api/workflows/{}", BASE_URL, workflow_id))
        .send()
        .await
        .expect("Failed to delete workflow");

    assert!(
        delete_response.status().is_success(),
        "Delete workflow failed: status {}",
        delete_response.status()
    );

    println!("Deleted workflow: {}", workflow_id);

    // Step 8: Verify deletion (should return 404 or similar)
    let verify_response = client
        .get(format!("{}/api/workflows/{}", BASE_URL, workflow_id))
        .send()
        .await
        .expect("Failed to verify deletion");

    assert!(
        !verify_response.status().is_success(),
        "Workflow should not exist after deletion"
    );

    println!("Workflow lifecycle test completed successfully!");
}

// ============================================================================
// Test 6: Workflow with Tasks and Terminals
// ============================================================================

#[tokio::test]
async fn test_workflow_with_tasks() {
    let client = create_client();

    // Get CLI type and model IDs
    let cli_response = client
        .get(format!("{}/api/cli_types", BASE_URL))
        .send()
        .await
        .expect("Failed to get CLI types");

    let cli_types: Vec<serde_json::Value> = cli_response
        .json()
        .await
        .expect("Failed to parse CLI types");

    let claude_cli = cli_types
        .iter()
        .find(|c| c["name"] == "claude-code")
        .expect("Claude CLI not found");

    let cli_id = claude_cli["id"].as_str().expect("Missing CLI ID");

    let models_response = client
        .get(format!("{}/api/cli_types/{}/models", BASE_URL, cli_id))
        .send()
        .await
        .expect("Failed to get models");

    let models: Vec<serde_json::Value> = models_response
        .json()
        .await
        .expect("Failed to parse models");

    let model_id = models[0]["id"].as_str().expect("Missing model ID");

    // Create workflow with slash commands
    let workflow_req = json!({
        "project_id": format!("test-project-{}", uuid::Uuid::new_v4()),
        "name": "Multi-Task Test Workflow",
        "description": "Test workflow with multiple parallel tasks",
        "use_slash_commands": true,
        "command_preset_ids": ["cmd-write-code", "cmd-test", "cmd-review"],
        "orchestrator_config": {
            "api_type": "anthropic",
            "base_url": "https://api.anthropic.com",
            "api_key": "test-key-for-e2e",
            "model": "claude-opus-4-5-20251101"
        },
        "merge_terminal_config": {
            "cli_type_id": cli_id,
            "model_config_id": model_id
        },
        "target_branch": "main"
    });

    let create_response = client
        .post(format!("{}/api/workflows", BASE_URL))
        .json(&workflow_req)
        .send()
        .await
        .expect("Failed to create workflow");

    assert!(
        create_response.status().is_success(),
        "Create workflow with tasks failed: status {}",
        create_response.status()
    );

    let create_result: serde_json::Value = create_response
        .json()
        .await
        .expect("Failed to parse create response");

    let workflow = &create_result["data"]["workflow"];
    let workflow_id = workflow["id"].as_str().expect("Missing workflow ID");

    println!("Created workflow with commands: {}", workflow_id);

    // Verify commands are associated
    let commands = create_result["data"]["commands"]
        .as_array()
        .expect("Missing commands array");

    assert_eq!(
        commands.len(),
        3,
        "Expected 3 commands, got {}",
        commands.len()
    );

    // Verify command order
    assert_eq!(
        commands[0]["preset_id"],
        "cmd-write-code",
        "First command should be write-code"
    );
    assert_eq!(
        commands[1]["preset_id"],
        "cmd-test",
        "Second command should be test"
    );
    assert_eq!(
        commands[2]["preset_id"],
        "cmd-review",
        "Third command should be review"
    );

    println!("Command association verified: {} commands", commands.len());

    // Cleanup
    client
        .delete(format!("{}/api/workflows/{}", BASE_URL, workflow_id))
        .send()
        .await
        .expect("Failed to cleanup workflow");

    println!("Workflow with tasks test completed!");
}

// ============================================================================
// Test 7: Error Handling
// ============================================================================

#[tokio::test]
async fn test_workflow_error_handling() {
    let client = create_client();

    // Test 1: Create workflow with invalid CLI type
    let invalid_workflow = json!({
        "project_id": "test-project",
        "name": "Invalid Workflow",
        "use_slash_commands": false,
        "merge_terminal_config": {
            "cli_type_id": "non-existent-cli",
            "model_config_id": "non-existent-model"
        }
    });

    let response = client
        .post(format!("{}/api/workflows", BASE_URL))
        .json(&invalid_workflow)
        .send()
        .await
        .expect("Failed to send request");

    // Should return error (400 or similar)
    assert!(
        !response.status().is_success() || response.status().as_u16() == 400,
        "Should reject invalid CLI type"
    );

    println!("Invalid CLI type rejected correctly");

    // Test 2: Get non-existent workflow
    let fake_id = uuid::Uuid::new_v4().to_string();
    let response = client
        .get(format!("{}/api/workflows/{}", BASE_URL, fake_id))
        .send()
        .await
        .expect("Failed to send request");

    assert!(
        !response.status().is_success(),
        "Should return error for non-existent workflow"
    );

    println!("Non-existent workflow rejected correctly");

    // Test 3: Update workflow with invalid status
    let invalid_status = json!({
        "status": "invalid_status_value"
    });

    let response = client
        .put(format!("{}/api/workflows/{}/status", BASE_URL, fake_id))
        .json(&invalid_status)
        .send()
        .await
        .expect("Failed to send request");

    // Should reject invalid status
    assert!(
        !response.status().is_success(),
        "Should reject invalid status value"
    );

    println!("Invalid status rejected correctly");

    println!("Error handling test completed!");
}
```

**Run:**
```bash
cargo check --tests
```

**Expected:** Compilation succeeds (may have warnings about unused code if server not running).

---

### Step 8.1.4: Run e2e tests with server running

**Run:**
```bash
# Terminal 1: Start server
cargo run

# Terminal 2: Run e2e tests
cargo test --test workflow_test -- --nocapture --test-threads=1
```

**Expected Output:**
```
Running tests/test_workflow_test.rs...

test_cli_detection ... ok
test_list_cli_types ... ok
test_list_models_for_cli ... ok
test_list_command_presets ... ok
test_workflow_lifecycle ... ok
test_workflow_with_tasks ... ok
test_workflow_error_handling ... ok

Test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured
```

**If tests fail:** Check server logs, ensure database is initialized with workflow tables.

---

### Step 8.1.5: Create e2e test documentation

**File:** `tests/e2e/README.md`

**Write:**
```markdown
# End-to-End Tests

This directory contains integration tests that verify the complete workflow system.

## Prerequisites

1. Start the server:
   ```bash
   cargo run
   ```

2. Ensure database is initialized with workflow tables:
   ```bash
   # Migrations run automatically on first start
   ```

## Running Tests

Run all e2e tests:
```bash
cargo test --test workflow_test -- --nocapture --test-threads=1
```

Run specific test:
```bash
cargo test test_workflow_lifecycle -- --nocapture
```

## Test Coverage

- `test_cli_detection`: Verifies CLI type detection
- `test_list_cli_types`: Lists all available CLI types
- `test_list_models_for_cli`: Gets models for a specific CLI
- `test_list_command_presets`: Lists slash command presets
- `test_workflow_lifecycle`: Complete CRUD operations for workflows
- `test_workflow_with_tasks`: Workflow with slash commands and orchestrator
- `test_workflow_error_handling`: Invalid request handling

## Adding New Tests

Follow this pattern:
1. Create `Client` with timeout
2. Make HTTP request to server
3. Assert response status
4. Parse and verify response body
5. Clean up (delete created resources)
```

**Commit:**
```bash
git add tests/e2e/
git commit -m "feat(tests): add end-to-end workflow tests

- Add workflow lifecycle tests (create, read, update, delete)
- Add CLI detection and model listing tests
- Add slash command preset tests
- Add error handling tests
- Include comprehensive test documentation"
```

---

## Task 8.2: Performance Optimization

**Files:**
- Modify: `crates/db/src/models/workflow.rs` (add batch operations)
- Create: `crates/db/migrations/20260119000001_add_performance_indexes.sql`

---

### Step 8.2.1: Create performance indexes migration

**File:** `crates/db/migrations/20260119000001_add_performance_indexes.sql`

**Write:**
```sql
-- ============================================================================
-- Performance Indexes for Workflow Tables
-- Created: 2026-01-19
-- Description: Add composite indexes for common query patterns
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Workflow Table Indexes
-- ----------------------------------------------------------------------------

-- Composite index for project + status queries (common in workflow list)
CREATE INDEX IF NOT EXISTS idx_workflow_project_status
ON workflow(project_id, status)
WHERE status IN ('created', 'ready', 'running');

-- Index for active workflows (monitoring dashboard)
CREATE INDEX IF NOT EXISTS idx_workflow_active
ON workflow(status, created_at DESC)
WHERE status NOT IN ('completed', 'failed', 'cancelled');

-- Index for workflow cleanup (old completed workflows)
CREATE INDEX IF NOT EXISTS idx_workflow_completed_cleanup
ON workflow(project_id, completed_at)
WHERE status IN ('completed', 'failed', 'cancelled')
AND completed_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Workflow Task Indexes
// ----------------------------------------------------------------------------

-- Composite index for workflow + status (task list in workflow detail)
CREATE INDEX IF NOT EXISTS idx_workflow_task_workflow_status
ON workflow_task(workflow_id, status, order_index);

-- Index for pending/running tasks (orchestrator queries)
CREATE INDEX IF NOT EXISTS idx_workflow_task_active
ON workflow_task(status, created_at)
WHERE status IN ('pending', 'running', 'review_pending');

-- ----------------------------------------------------------------------------
-- Terminal Indexes
// ----------------------------------------------------------------------------

-- Composite index for task + status (terminal list in task detail)
CREATE INDEX IF NOT EXISTS idx_terminal_task_status
ON terminal(workflow_task_id, status, order_index);

-- Index for active terminals (monitoring)
CREATE INDEX IF NOT EXISTS idx_terminal_active
ON terminal(status, started_at)
WHERE status IN ('starting', 'waiting', 'working');

-- Index for cleanup (old terminal logs)
CREATE INDEX IF NOT EXISTS idx_terminal_cleanup
ON terminal(workflow_task_id, completed_at)
WHERE status IN ('completed', 'failed', 'cancelled')
AND completed_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Git Event Indexes
// ----------------------------------------------------------------------------

-- Composite index for workflow + processing status (orchestrator event queue)
CREATE INDEX IF NOT EXISTS idx_git_event_workflow_status
ON git_event(workflow_id, process_status, created_at)
WHERE process_status IN ('pending', 'processing');

-- Index for terminal events (event-driven processing)
CREATE INDEX IF NOT EXISTS idx_git_event_terminal_status
ON git_event(terminal_id, process_status, created_at)
WHERE process_status = 'pending';

-- Index for processed event cleanup
CREATE INDEX IF NOT EXISTS idx_git_event_cleanup
ON git_event(workflow_id, processed_at)
WHERE process_status = 'processed'
AND processed_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Terminal Log Indexes
// ----------------------------------------------------------------------------

-- Index for log streaming (recent logs first)
CREATE INDEX IF NOT EXISTS idx_terminal_log_streaming
ON terminal_log(terminal_id, created_at DESC)
WHERE created_at > datetime('now', '-1 hour');

-- Index for log cleanup (old logs)
CREATE INDEX IF NOT EXISTS idx_terminal_log_cleanup
ON terminal_log(created_at)
WHERE created_at < datetime('now', '-7 days');

-- ----------------------------------------------------------------------------
-- Analyze tables after index creation
// ----------------------------------------------------------------------------

ANALYZE workflow;
ANALYZE workflow_task;
ANALYZE terminal;
ANALYZE git_event;
ANALYZE terminal_log;
```

**Run migration:**
```bash
cargo run --bin migrate
```

**Expected:** Migration applies successfully, indexes created.

---

### Step 8.2.2: Optimize database connection pool

**File:** `crates/server/src/main.rs` (find DBService initialization)

**Locate the connection pool creation (around line 200-300):**

**Find:**
```rust
SqlitePoolOptions::new()
    .connect(&database_url)
    .await?
```

**Replace with:**
```rust
use sqlx::sqlite::SqlitePoolOptions;
use std::time::Duration;

let pool = SqlitePoolOptions::new()
    .max_connections(10)           // Maximum concurrent connections
    .min_connections(2)            // Minimum idle connections
    .acquire_timeout(Duration::from_secs(30))  // Connection acquisition timeout
    .idle_timeout(Duration::from_secs(600))    // Idle connection timeout (10 min)
    .max_lifetime(Duration::from_secs(3600))   // Connection lifetime (1 hour)
    .test_before_acquire(true)     // Verify connection health before use
    .connect(&database_url)
    .await?;
```

**Run:**
```bash
cargo check
```

**Expected:** Compilation succeeds.

---

### Step 8.2.3: Add query performance logging

**File:** `crates/db/src/models/workflow.rs`

**Add to top of file:**
```rust
use tracing::{instrument, debug};
```

**Add instrumentation to `find_by_project`:**

**Find:**
```rust
pub async fn find_by_project(pool: &SqlitePool, project_id: &str) -> sqlx::Result<Vec<Self>> {
    sqlx::query_as::<_, Workflow>(
        r#"
        SELECT * FROM workflow
        WHERE project_id = ?
        ORDER BY created_at DESC
        "#
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
}
```

**Replace with:**
```rust
#[instrument(skip(pool), fields(project_id = %project_id))]
pub async fn find_by_project(pool: &SqlitePool, project_id: &str) -> sqlx::Result<Vec<Self>> {
    let start = std::time::Instant::now();

    let result = sqlx::query_as::<_, Workflow>(
        r#"
        SELECT * FROM workflow
        WHERE project_id = ?
        ORDER BY created_at DESC
        "#
    )
    .bind(project_id)
    .fetch_all(pool)
    .await?;

    debug!(
        project_id = %project_id,
        count = result.len(),
        elapsed_ms = start.elapsed().as_millis(),
        "Workflow::find_by_project completed"
    );

    Ok(result)
}
```

**Run:**
```bash
cargo check
```

**Expected:** Compilation succeeds.

---

### Step 8.2.4: Add performance benchmark tests

**File:** `crates/db/benches/workflow_bench.rs` (create directory and file)

**Create:**
```bash
mkdir -p crates/db/benches
```

**Write:**
```rust
//! Workflow Query Performance Benchmarks
//!
//! Run with: cargo bench --bench workflow_bench

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use db::models::{Workflow, WorkflowTask, Terminal};
use sqlx::SqlitePool;
use tokio::runtime::Runtime;
use uuid::Uuid;

fn setup_test_db() -> SqlitePool {
    let rt = Runtime::new().unwrap();
    rt.block_on(async {
        let pool = SqlitePool::connect(":memory:").await.unwrap();

        // Run migrations
        sqlx::query(include_str!("../migrations/20260117000001_create_workflow_tables.sql"))
            .execute(&pool)
            .await
            .unwrap();

        sqlx::query(include_str!("../migrations/20260119000001_add_performance_indexes.sql"))
            .execute(&pool)
            .await
            .unwrap();

        pool
    })
}

fn create_test_workflow(pool: &SqlitePool, project_id: &str) -> Workflow {
    let rt = Runtime::new().unwrap();
    rt.block_on(async {
        let workflow = Workflow {
            id: Uuid::new_v4().to_string(),
            project_id: project_id.to_string(),
            name: "Benchmark Workflow".to_string(),
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
            merge_terminal_cli_id: "cli-claude-code".to_string(),
            merge_terminal_model_id: "model-claude-sonnet".to_string(),
            target_branch: "main".to_string(),
            ready_at: None,
            started_at: None,
            completed_at: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        Workflow::create(pool, &workflow).await.unwrap()
    })
}

fn benchmark_find_by_project(c: &mut Criterion) {
    let pool = setup_test_db();

    // Create test data
    for i in 0..100 {
        create_test_workflow(&pool, &format!("project-{}", i % 10));
    }

    let rt = Runtime::new().unwrap();
    c.bench_function("find_by_project", |b| {
        b.to_async(&rt).iter(|| {
            let pool = &pool;
            async move {
                black_box(
                    Workflow::find_by_project(pool, "project-1").await.unwrap()
                );
            }
        })
    });
}

fn benchmark_find_by_id(c: &mut Criterion) {
    let pool = setup_test_db();
    let workflow = create_test_workflow(&pool, "benchmark-project");
    let workflow_id = workflow.id.clone();

    let rt = Runtime::new().unwrap();
    c.bench_function("find_by_id", |b| {
        b.to_async(&rt).iter(|| {
            let pool = &pool;
            let id = workflow_id.clone();
            async move {
                black_box(
                    Workflow::find_by_id(pool, &id).await.unwrap()
                );
            }
        })
    });
}

criterion_group!(benches, benchmark_find_by_project, benchmark_find_by_id);
criterion_main!(benches);
```

**Add to `crates/db/Cargo.toml`:**

```toml
[dev-dependencies]
criterion = "0.5"

[[bench]]
name = "workflow_bench"
harness = false
```

**Run:**
```bash
cargo bench --bench workflow_bench
```

**Expected:** Benchmark runs and shows timing results.

---

### Step 8.2.5: Create performance monitoring guide

**File:** `docs/performance-monitoring.md`

**Write:**
```markdown
# Performance Monitoring Guide

## Database Indexes

The following indexes have been added to optimize common query patterns:

### Workflow Queries

- `idx_workflow_project_status`: Optimizes workflow list by project and status
- `idx_workflow_active`: Quick access to active workflows
- `idx_workflow_completed_cleanup`: Efficient cleanup of old workflows

### Task Queries

- `idx_workflow_task_workflow_status`: Task list within workflow
- `idx_workflow_task_active`: Active tasks for orchestrator

### Terminal Queries

- `idx_terminal_task_status`: Terminal list within task
- `idx_terminal_active`: Active terminals for monitoring

### Event Queries

- `idx_git_event_workflow_status`: Event queue for orchestrator
- `idx_git_event_terminal_status`: Per-terminal event processing

## Connection Pool Configuration

The connection pool is configured with:

- `max_connections: 10` - Maximum concurrent database connections
- `min_connections: 2` - Minimum idle connections maintained
- `acquire_timeout: 30s` - Timeout when acquiring connection
- `idle_timeout: 600s` - Close idle connections after 10 minutes
- `max_lifetime: 3600s` - Recreate connections after 1 hour

## Running Benchmarks

Run performance benchmarks:
```bash
cargo bench --bench workflow_bench
```

## Monitoring

Enable query performance logging by setting:
```bash
RUST_LOG=debug cargo run
```

Look for log entries like:
```
Workflow::find_by_project project_id=project-1 count=5 elapsed_ms=2
```

## Cleanup Queries

Remove old data (run periodically):
```sql
-- Delete completed workflows older than 30 days
DELETE FROM workflow
WHERE status IN ('completed', 'failed', 'cancelled')
AND completed_at < datetime('now', '-30 days');

-- Delete terminal logs older than 7 days
DELETE FROM terminal_log
WHERE created_at < datetime('now', '-7 days');
```
```

**Commit:**
```bash
git add crates/db/migrations/20260119000001_add_performance_indexes.sql
git add crates/server/src/main.rs
git add crates/db/src/models/workflow.rs
git add crates/db/benches/
git add docs/performance-monitoring.md
git commit -m "feat(db): add performance optimizations

- Add composite indexes for common query patterns
- Configure connection pool with optimal settings
- Add query performance logging with instrumentation
- Create performance benchmarks for workflow queries
- Document performance monitoring and cleanup procedures"
```

---

## Task 8.3: User Documentation

**Files:**
- Create: `docs/workflow-guide.md`
- Modify: `README.md` (add workflow section)

---

### Step 8.3.1: Create comprehensive workflow guide

**File:** `docs/workflow-guide.md`

**Write:**
```markdown
# GitCortex Workflow User Guide

## Overview

GitCortex Workflow allows you to orchestrate multiple AI coding agents working in parallel on complex development tasks. Each workflow can:

- Run multiple coding agents simultaneously on different Git branches
- Coordinate agents using a main orchestrator agent
- Apply slash commands for standardized operations
- Merge results automatically or with human review

## Quick Start

### 1. Access Workflows

Navigate to your project and click the "Workflows" tab in the sidebar.

### 2. Create a Workflow

Click "Create Workflow" to open the workflow creation wizard.

### 3. Configure Workflow

**Basic Settings:**
- **Name**: Descriptive name for your workflow
- **Description**: Optional detailed description
- **Target Branch**: Branch to merge into (default: `main`)

**Parallel Tasks:**
- Add one or more tasks that will run simultaneously
- Each task gets its own Git branch
- Each task can have multiple terminals with different roles

**Terminals:**
- Choose CLI type (Claude Code, Gemini CLI, etc.)
- Select model (Sonnet, Opus, Haiku for Claude)
- Set role: `coder`, `reviewer`, `fixer`, or custom
- Optionally override API base URL and key

**Main Orchestrator (Optional):**
- Enables intelligent coordination between parallel tasks
- Choose API provider (Anthropic, OpenAI, or custom)
- Set model (recommend Opus for complex coordination)
- Provide API key (encrypted at rest)

**Slash Commands (Optional):**
- Select predefined commands to apply
- Commands execute in order on each terminal
- Examples: `/write-code`, `/test`, `/review`, `/fix-issues`

**Merge Terminal:**
- Required: Configures the terminal for merging branches
- Uses selected CLI type and model

### 4. Start Workflow

After creation:
1. Workflow status will be "created"
2. Click "Start" when ready
3. Workflow enters "ready" status when all terminals are prepared
4. Click "Confirm Start" to begin execution

## Workflow States

| State | Description |
|-------|-------------|
| `created` | Workflow created, waiting for configuration |
| `starting` | Launching terminals for each task |
| `ready` | All terminals ready, waiting for user confirmation |
| `running` | Actively executing tasks |
| `paused` | Temporarily paused (can be resumed) |
| `merging` | Merging branches into target |
| `completed` | All tasks finished successfully |
| `failed` | One or more tasks failed |
| `cancelled` | Cancelled by user |

## Terminal Debugging

While workflow is running:

### View Terminal Output

1. Switch to "Terminal Debug" tab
2. Select terminal from dropdown
3. View real-time output
4. Scroll through history

### Manual Intervention

If needed, you can:
- Type commands directly into terminal
- Send signals (Ctrl+C, etc.)
- Attach to terminal PTY session

### Terminal Status

| Status | Description |
|--------|-------------|
| `not_started` | Terminal not yet launched |
| `starting` | Launching process |
| `waiting` | Waiting for input/instruction |
| `working` | Actively processing |
| `completed` | Finished successfully |
| `failed` | Process crashed or failed |
| `cancelled` | Cancelled by user |

## Slash Commands

### Available Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `/write-code` | Write feature code | Implement new features |
| `/test` | Write and run tests | Add test coverage |
| `/review` | Code review | Security and quality check |
| `/fix-issues` | Fix discovered issues | Bug fixes |
| `/refactor` | Refactor code | Improve code quality |
| `/document` | Write documentation | Generate docs |

### Creating Custom Commands

Contact your administrator to add custom slash command presets.

## Best Practices

### 1. Task Decomposition

**Good:** Split into independent, parallelizable tasks
```
- Task 1: Implement authentication
- Task 2: Implement database models
- Task 3: Implement API endpoints
```

**Avoid:** Tasks with dependencies
```
- Task 1: Create base class
- Task 2: Extend base class  <-- Will fail if Task 1 incomplete
```

### 2. Model Selection

| Model | Use Case | Cost |
|-------|----------|------|
| Haiku | Simple tasks, quick iterations | Low |
| Sonnet | General development | Medium |
| Opus | Complex coordination, review | High |

**Recommendations:**
- Use Opus for orchestrator (coordination requires reasoning)
- Use Sonnet for coding tasks (good balance)
- Use Haiku for simple fixes/iterations

### 3. Review Workflow

For critical code:
1. Add `reviewer` terminal to each task
2. Use `/review` slash command
3. Enable human review before merge

### 4. Error Handling

Enable error terminal for workflows that need automated recovery:
- Orchestrator can detect failures
- Error terminal receives fix instructions
- Automated retry possible

### 5. Branch Management

**Automatic:** Tasks create branches like `workflow/{id}/task/{index}/{name}`

**Custom:** Set custom branch names in task configuration.

## Example Workflows

### Example 1: Simple Feature

**Goal:** Add user profile page

**Configuration:**
- 1 Task: "Implement profile page"
- 1 Terminal: Claude Code + Sonnet
- Slash Commands: `/write-code`, `/test`
- No orchestrator needed

**Expected:** Single branch created, merged after completion.

### Example 2: Parallel Feature Development

**Goal:** Add authentication + database + API

**Configuration:**
- 3 Tasks (parallel):
  - "Auth service"
  - "Database models"
  - "API endpoints"
- Each with 1-2 terminals
- Orchestrator: Opus (coordinates dependencies)
- Merge terminal: Sonnet (handles merge conflicts)

**Expected:** Three branches created, merged sequentially by orchestrator.

### Example 3: Full Stack with Review

**Goal:** Complex feature with quality assurance

**Configuration:**
- 2 Tasks:
  - "Backend" (2 terminals: coder + reviewer)
  - "Frontend" (2 terminals: coder + reviewer)
- Orchestrator: Opus
- Slash Commands: `/write-code`, `/test`, `/review`
- Error terminal: Enabled

**Expected:** High-quality code with automated review process.

## Troubleshooting

### Workflow Stuck in "starting"

**Cause:** Terminal launch failure

**Solution:**
1. Check terminal debug tab for errors
2. Verify CLI is installed: `claude --version`
3. Check API credentials
4. Review system logs

### Workflow Fails with "merge conflict"

**Cause:** Parallel tasks modified same files

**Solution:**
1. Check merge terminal output
2. Manual resolution may be required
3. Consider task decomposition to reduce conflicts

### High API Costs

**Cause:** Opus model overuse, long-running workflows

**Solution:**
1. Use Sonnet/Haiku where appropriate
2. Set clear task boundaries
3. Add iteration limits
4. Monitor token usage in dashboard

### Slow Workflow Execution

**Cause:** Network latency, model response time

**Solution:**
1. Check internet connection
2. Consider regional API endpoints
3. Reduce task complexity
4. Use faster models (Haiku/Sonnet)

## API Reference

See [API Documentation](../api/workflows.md) for programmatic workflow management.

## Support

For issues or questions:
- GitHub: [gitcortex/issues](https://github.com/gitcortex/gitcortex/issues)
- Discord: [GitCortex Community](https://discord.gg/gitcortex)
- Email: support@gitcortex.com
```

---

### Step 8.3.2: Update main README with workflow section

**File:** `README.md`

**Find the "Overview" section and add after it:**

**Add:**
```markdown
## Workflow Orchestration

GitCortex includes a powerful workflow orchestration system that allows you to:

- **Parallel Development**: Run multiple AI coding agents simultaneously on different Git branches
- **Intelligent Coordination**: Use a main orchestrator agent to coordinate parallel tasks
- **Standardized Operations**: Apply slash commands for consistent code generation and review
- **Automated Merging**: Merge branches automatically or with human review

### Quick Example

```typescript
// Create a workflow with 3 parallel tasks
const workflow = await fetch('/api/workflows', {
  method: 'POST',
  body: JSON.stringify({
    project_id: 'my-project',
    name: 'Add authentication system',
    use_slash_commands: true,
    command_preset_ids: ['cmd-write-code', 'cmd-test', 'cmd-review'],
    orchestrator_config: {
      api_type: 'anthropic',
      base_url: 'https://api.anthropic.com',
      api_key: process.env.ANTHROPIC_API_KEY,
      model: 'claude-opus-4-5-20251101'
    },
    merge_terminal_config: {
      cli_type_id: 'cli-claude-code',
      model_config_id: 'model-claude-sonnet'
    },
    target_branch: 'main'
  })
});
```

### Documentation

See [Workflow User Guide](docs/workflow-guide.md) for complete documentation.
```

**Commit:**
```bash
git add docs/workflow-guide.md
git add README.md
git commit -m "docs(workflow): add comprehensive user documentation

- Add complete workflow user guide with examples
- Document workflow states and lifecycle
- Add terminal debugging instructions
- Include best practices and troubleshooting
- Update README with workflow overview section"
```

---

## Phase 8 Completion Checklist

- [ ] Task 8.1: End-to-end tests created and passing
  - [ ] `tests/e2e/workflow_test.rs` with 7+ tests
  - [ ] Tests verify complete workflow lifecycle
  - [ ] Error handling tests included
- [ ] Task 8.2: Performance optimizations implemented
  - [ ] Database indexes added
  - [ ] Connection pool configured
  - [ ] Performance benchmarks created
  - [ ] Monitoring documentation written
- [ ] Task 8.3: User documentation completed
  - [ ] Workflow guide created
  - [ ] README updated
  - [ ] Examples and troubleshooting included

---

## Verification Commands

Run all Phase 8 tests:

```bash
# E2E tests (server must be running)
cargo test --test workflow_test -- --test-threads=1

# Performance benchmarks
cargo bench --bench workflow_bench

# Full test suite
cargo test --workspace
```

**Expected Result:** All tests pass, benchmarks show reasonable performance (<100ms for indexed queries).

---

## Post-Completion Steps

After all tasks complete:

1. **Run full test suite:**
   ```bash
   cargo test --workspace --all-features
   ```

2. **Check for warnings:**
   ```bash
   cargo clippy --workspace -- -D warnings
   ```

3. **Format code:**
   ```bash
   cargo fmt --all
   ```

4. **Create PR with:**
   - All test passing evidence
   - Benchmark results
   - Documentation links

---

*Plan Version: 1.0*
*Created: 2026-01-19*
*Author: Claude Code with Superpowers Workflow*
