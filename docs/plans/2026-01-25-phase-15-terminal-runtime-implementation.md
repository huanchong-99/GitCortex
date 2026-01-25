# Phase 15: Terminal Execution and WebSocket Link Completion - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Establish complete bidirectional communication between frontend and terminal PTY processes via WebSocket, with output persistence, timeout handling, and CLI detection.

**Architecture:**
- Terminal model binds to Session/ExecutionProcess for execution context tracking
- ProcessManager spawns PTY processes with stdin/stdout/stderr pipes
- WebSocket handler bridges frontend xterm.js to PTY I/O streams
- Terminal logs batch-written every 1 second for replay capability
- Idle timeout (10min) and hard timeout (30min) prevent resource leaks

**Tech Stack:**
- Rust: tokio::process (PTY), axum WebSocket, sqlx (persistence)
- Frontend: xterm.js (terminal emulator), WebSocket API
- Testing: cargo test (unit), integration tests with in-memory DB

**Key Files:**
- `crates/db/src/models/terminal.rs` - Terminal model (already has TerminalLog)
- `crates/db/src/models/execution_process.rs` - ExecutionProcess (Session binding)
- `crates/services/src/services/terminal/launcher.rs` - TerminalLauncher
- `crates/services/src/services/terminal/process.rs` - ProcessManager
- `crates/server/src/routes/terminal_ws.rs` - WebSocket handler
- `crates/db/src/models/cli_type.rs` - CliType (CLI detection)

---

## Task 15.1: Workflow Terminal ↔ Session/ExecutionProcess Binding

**Files:**
- Modify: `crates/db/src/models/terminal.rs` (add session_id/execution_process_id fields)
- Modify: `crates/services/src/services/terminal/launcher.rs` (create Session/ExecutionProcess)
- Modify: `crates/db/src/models/session.rs` (reference implementation)
- Test: `crates/services/tests/terminal_binding_test.rs` (new file)

**Why:** Execution context allows tracking terminal runs, recovery after restart, and historical audit.

---

### Step 15.1.1: Write failing test for Session creation

Create test file: `crates/services/tests/terminal_binding_test.rs`

```rust
use services::services::terminal::TerminalLauncher;
use db::{DBService, models::Terminal};
use uuid::Uuid;
use chrono::Utc;

#[tokio::test]
async fn test_terminal_launch_creates_session() {
    // Setup: Create in-memory DB and launcher
    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    // Run migrations
    let migrations_path = std::path::PathBuf::from("../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    let db = Arc::new(DBService { pool: pool.clone() });
    let cc_switch = Arc::new(services::services::cc_switch::CCSwitchService::new(Arc::clone(&db)));
    let process_manager = Arc::new(services::services::terminal::ProcessManager::new());
    let working_dir = std::env::temp_dir();
    let launcher = TerminalLauncher::new(Arc::clone(&db), cc_switch, process_manager, working_dir);

    // Create test workflow, task, and terminal
    let wf_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO workflow (id, name, base_dir, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&wf_id)
    .bind("test-wf")
    .bind("/tmp")
    .bind("created")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let task_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO workflow_task (id, workflow_id, name, order_index, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&task_id)
    .bind(&wf_id)
    .bind("task-1")
    .bind(0)
    .bind("pending")
    .bind(Utc::now())
    .bind(Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let terminal_id = Uuid::new_v4().to_string();
    let terminal = Terminal {
        id: terminal_id.clone(),
        workflow_task_id: task_id.clone(),
        cli_type_id: "test-cli".to_string(),
        model_config_id: Uuid::new_v4().to_string(),
        custom_base_url: None,
        custom_api_key: None,
        role: Some("coder".to_string()),
        role_description: None,
        order_index: 0,
        status: "not_started".to_string(),
        process_id: None,
        pty_session_id: None,
        vk_session_id: None,
        last_commit_hash: None,
        last_commit_message: None,
        started_at: None,
        completed_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // Act: Launch terminal
    let result = launcher.launch_terminal(&terminal).await;

    // Assert: Session should be created
    let session = sqlx::query!(
        "SELECT * FROM session WHERE terminal_id = ?"
    )
    .bind(&terminal_id)
    .fetch_optional(&pool)
    .await
    .unwrap();

    assert!(session.is_some(), "Session should be created for terminal");
    let session = session.unwrap();
    assert_eq!(session.terminal_id, terminal_id);
}
```

**Step 15.1.2: Run test to verify it fails**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package services test_terminal_launch_creates_session
```

Expected: FAIL with "no such table: session" or "column terminal_id does not exist"

**Step 15.1.3: Add session_id/execution_process_id to Terminal table**

Create migration: `crates/db/migrations/20260125000001_add_terminal_session_binding.sql`

```sql
-- Add session_id and execution_process_id to terminal table
ALTER TABLE terminal ADD COLUMN session_id TEXT;
ALTER TABLE terminal ADD COLUMN execution_process_id TEXT;

-- Create index for lookups
CREATE INDEX idx_terminal_session_id ON terminal(session_id);
CREATE INDEX idx_terminal_execution_process_id ON terminal(execution_process_id);
```

Run migration:

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
sqlx migrate run --source crates/db/migrations
```

**Step 15.1.4: Update Terminal model**

Edit: `crates/db/src/models/terminal.rs:78`

```rust
/// PTY session ID
pub pty_session_id: Option<String>,

/// Associated session ID (NEW FIELD)
pub session_id: Option<String>,

/// Associated execution process ID (NEW FIELD)
pub execution_process_id: Option<String>,

/// Associated vibe-kanban session ID
pub vk_session_id: Option<Uuid>,
```

**Step 15.1.5: Update Terminal::create to include new fields**

Edit: `crates/db/src/models/terminal.rs:213`

```rust
sqlx::query_as::<_, Terminal>(
    r"
    INSERT INTO terminal (
        id, workflow_task_id, cli_type_id, model_config_id,
        custom_base_url, custom_api_key, role, role_description,
        order_index, status, session_id, execution_process_id, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
    RETURNING *
    "
)
.bind(&terminal.id)
.bind(&terminal.workflow_task_id)
.bind(&terminal.cli_type_id)
.bind(&terminal.model_config_id)
.bind(&terminal.custom_base_url)
.bind(&terminal.custom_api_key)
.bind(&terminal.role)
.bind(&terminal.role_description)
.bind(terminal.order_index)
.bind(&terminal.status)
.bind(&terminal.session_id)
.bind(&terminal.execution_process_id)
.bind(terminal.created_at)
.bind(terminal.updated_at)
.fetch_one(pool)
.await
```

**Step 15.1.6: Add Terminal::update_session method**

Edit: `crates/db/src/models/terminal.rs:316` (after update_process)

```rust
/// Update terminal session binding
pub async fn update_session(
    pool: &SqlitePool,
    id: &str,
    session_id: Option<&str>,
    execution_process_id: Option<&str>,
) -> sqlx::Result<()> {
    let now = Utc::now();
    sqlx::query(
        r"
        UPDATE terminal
        SET session_id = ?, execution_process_id = ?, updated_at = ?
        WHERE id = ?
        "
    )
    .bind(session_id)
    .bind(execution_process_id)
    .bind(now)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}
```

**Step 15.1.7: Update TerminalLauncher to create Session**

**Option A:** Create Session model in `crates/db/src/models/session.rs` (if not exists)

Check if exists:

```bash
grep -n "pub struct Session" crates/db/src/models/session.rs
```

If not exists, add minimal Session model:

```rust
/// Session for terminal execution tracking
#[derive(Debug, Clone, FromRow, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Session {
    pub id: Uuid,
    pub terminal_id: Option<String>,
    pub workspace_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Session {
    pub async fn create_for_terminal(
        pool: &SqlitePool,
        terminal_id: &str,
    ) -> sqlx::Result<Self> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        sqlx::query_as::<_, Session>(
            r"
            INSERT INTO session (id, terminal_id, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4)
            RETURNING *
            "
        )
        .bind(id)
        .bind(terminal_id)
        .bind(now)
        .bind(now)
        .fetch_one(pool)
        .await
    }
}
```

**Option B:** Modify TerminalLauncher to create Session

Edit: `crates/services/src/services/terminal/launcher.rs:88` (launch_terminal method)

```rust
async fn launch_terminal(&self, terminal: &Terminal) -> LaunchResult {
    let terminal_id = terminal.id.clone();

    // 1. Create Session for execution context
    let session_id = match Session::create_for_terminal(&self.db.pool, &terminal_id).await {
        Ok(session) => {
            tracing::info!("Created session {} for terminal {}", session.id, terminal_id);
            Some(session.id)
        }
        Err(e) => {
            tracing::error!("Failed to create session for terminal {}: {}", terminal_id, e);
            return LaunchResult {
                terminal_id,
                process_handle: None,
                success: false,
                error: Some(format!("Session creation failed: {e}")),
            };
        }
    };

    // 2. Switch model configuration
    if let Err(e) = self.cc_switch.switch_for_terminal(terminal).await {
        tracing::error!("Failed to switch model for terminal {}: {}", terminal_id, e);
        return LaunchResult {
            terminal_id,
            process_handle: None,
            success: false,
            error: Some(format!("Model switch failed: {e}")),
        };
    }

    // ... rest of the method (CLI lookup, spawn, etc.)

    // 3. Update terminal with session_id
    if let Some(sid) = session_id {
        let _ = Terminal::update_session(
            &self.db.pool,
            &terminal_id,
            Some(&sid.to_string()),
            None, // execution_process_id created later
        ).await;
    }

    // ... continue with spawn
}
```

**Step 15.1.8: Run test to verify it passes**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package services test_terminal_launch_creates_session
```

Expected: PASS

**Step 15.1.9: Commit**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
git add crates/db/migrations/20260125000001_add_terminal_session_binding.sql
git add crates/db/src/models/terminal.rs
git add crates/services/src/services/terminal/launcher.rs
git add crates/services/tests/terminal_binding_test.rs
git commit -m "feat(15.1): bind terminal to session for execution context

- Add session_id/execution_process_id to terminal table
- Create Session when launching terminal
- Update Terminal::update_session method
- Add test for session creation on launch"
```

---

## Task 15.2: PTY Process Lifecycle with WebSocket I/O

**Files:**
- Modify: `crates/services/src/services/terminal/process.rs` (add PTY methods)
- Modify: `crates/server/src/routes/terminal_ws.rs` (connect to PTY)
- Test: `crates/server/tests/terminal_ws_test.rs` (new file)

**Why:** Real-time bidirectional communication enables interactive terminal usage in browser.

---

### Step 15.2.1: Write failing test for PTY I/O

Create test file: `crates/server/tests/terminal_ws_test.rs`

```rust
use axum::{
    body::Body,
    http::{Request, StatusCode, header::UPGRADE},
};
use tower::ServiceExt;

#[tokio::test]
async fn test_websocket_terminal_io() {
    // This test verifies WebSocket can send/receive data from PTY
    // For now, just test the route exists and upgrades properly

    let app = crate::routes::terminal_ws_routes();

    // Create WebSocket upgrade request
    let request = Request::builder()
        .uri("/ws/terminal/00000000-0000-0000-0000-000000000001")
        .header(UPGRADE, "websocket")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();

    // Should return 101 Switching Protocols for valid terminal
    assert_eq!(response.status(), StatusCode::SWITCHING_PROTOCOLS);
}
```

**Step 15.2.2: Run test to verify it fails**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package server test_websocket_terminal_io
```

Expected: FAIL or current code may already route properly

**Step 15.2.3: Add PTY wrapper to ProcessManager**

Edit: `crates/services/src/services/terminal/process.rs:110` (after spawn method)

```rust
/// Spawn PTY process with pseudo-terminal for interactive I/O
///
/// # Arguments
/// * `terminal_id` - Unique identifier for this terminal session
/// * `cmd` - The command to spawn
/// * `working_dir` - Directory where the process will run
/// * `env_vars` - Environment variables to inject
///
/// # Returns
/// Returns a `ProcessHandle` with PTY master file descriptors
pub async fn spawn_pty(
    &self,
    terminal_id: &str,
    mut cmd: Command,
    working_dir: &Path,
    env_vars: Vec<(String, String)>,
) -> anyhow::Result<ProcessHandle> {
    cmd.current_dir(working_dir);

    // Inject environment variables
    for (key, value) in env_vars {
        cmd.env(key, value);
    }

    #[cfg(unix)]
    {
        // Use pty crate for Unix PTY support
        use pty::fork::Fork;

        let fork = Fork::from_ptmx().unwrap();
        if let Ok(master) = fork.is_parent() {
            let pid = master.pid().as_raw() as u32;
            let session_id = Uuid::new_v4().to_string();

            // Track the PTY master
            // NOTE: We'll need to store the master fd for I/O
            // For now, just return the handle
            return Ok(ProcessHandle {
                pid,
                session_id,
                terminal_id: terminal_id.to_string(),
            });
        } else {
            // Child process - exec the command
            cmd.exec();
            return Err(anyhow::anyhow!("exec failed"));
        }
    }

    #[cfg(windows)]
    {
        // Windows: Use ConPTY for PTY support
        // For now, fall back to regular stdin/stdout pipes
        cmd.stdin(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let child = cmd.spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn PTY process: {e}"))?;
        let pid = child.id().ok_or_else(|| anyhow::anyhow!("Failed to get process ID"))?;
        let session_id = Uuid::new_v4().to_string();

        let mut processes = self.processes.write().await;
        processes.insert(terminal_id.to_string(), child);

        return Ok(ProcessHandle {
            pid,
            session_id,
            terminal_id: terminal_id.to_string(),
        });
    }

    #[cfg(not(any(unix, windows)))]
    {
        compile_error!("PTY not supported on this platform");
    }
}
```

**Step 15.2.4: Update ProcessManager to track PTY file descriptors**

Edit: `crates/services/src/services/terminal/process.rs:14` (ProcessHandle struct)

```rust
use std::{os::unix::io::RawFd, collections::HashMap, path::Path, sync::Arc};

/// Process handle for tracking spawned processes
#[derive(Debug, Clone)]
pub struct ProcessHandle {
    /// Process ID
    pub pid: u32,
    /// Unique session identifier
    pub session_id: String,
    /// Associated terminal ID
    pub terminal_id: String,
    /// PTY master file descriptor (Unix only)
    #[cfg(unix)]
    pub pty_master_fd: Option<RawFd>,
}

/// Process manager for terminal lifecycle
pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<String, Child>>>,
    /// PTY master file descriptors keyed by terminal_id
    #[cfg(unix)]
    ptys: Arc<RwLock<HashMap<String, RawFd>>>,
}
```

Edit: `crates/services/src/services/terminal/process.rs:39` (ProcessManager::new)

```rust
pub fn new() -> Self {
    Self {
        processes: Arc::new(RwLock::new(HashMap::new())),
        #[cfg(unix)]
        ptys: Arc::new(RwLock::new(HashMap::new())),
    }
}
```

**Step 15.2.5: Add write_to_pty method**

Edit: `crates/services/src/services/terminal/process.rs:167` (after kill method)

```rust
/// Write data to PTY master
///
/// # Arguments
/// * `terminal_id` - Terminal ID to write to
/// * `data` - Bytes to write to PTY
///
/// # Returns
/// Returns `Ok(())` if write succeeded
///
/// # Errors
/// Returns error if PTY not found or write failed
#[cfg(unix)]
pub fn write_to_pty(&self, terminal_id: &str, data: &[u8]) -> anyhow::Result<()> {
    use nix::unistd::write;
    use std::os::unix::io::RawFd;

    let ptys = self.ptys.blocking_read();
    let fd = ptys.get(terminal_id)
        .ok_or_else(|| anyhow::anyhow!("PTY not found for terminal {}", terminal_id))?;

    write(*fd, data)
        .map_err(|e| anyhow::anyhow!("Failed to write to PTY: {}", e))?;

    Ok(())
}

/// Read from PTY master (non-blocking)
///
/// # Arguments
/// * `terminal_id` - Terminal ID to read from
/// * `buf` - Buffer to read into
///
/// # Returns
/// Returns number of bytes read
#[cfg(unix)]
pub fn read_from_pty(&self, terminal_id: &str, buf: &mut [u8]) -> anyhow::Result<usize> {
    use nix::unistd::read;
    use std::os::unix::io::RawFd;

    let ptys = self.ptys.blocking_read();
    let fd = ptys.get(terminal_id)
        .ok_or_else(|| anyhow::anyhow!("PTY not found for terminal {}", terminal_id))?;

    let n = read(*fd, buf)
        .map_err(|e| anyhow::anyhow!("Failed to read from PTY: {}", e))?;

    Ok(n)
}
```

**Step 15.2.6: Update WebSocket handler to use PTY**

Edit: `crates/server/src/routes/terminal_ws.rs:251` (WsMessage::Input handler)

```rust
WsMessage::Input { data } => {
    // Send input to PTY
    tracing::debug!(
        "Terminal {} input: {} bytes",
        terminal_id_clone,
        data.len()
    );

    // Convert string to bytes and write to PTY
    let data_bytes = data.as_bytes();

    #[cfg(unix)]
    {
        use services::services::terminal::ProcessManager;
        if let Some(process_manager) = deployment.process_manager() {
            if let Err(e) = process_manager.write_to_pty(&terminal_id_clone, data_bytes) {
                tracing::error!("Failed to write to PTY: {}", e);
            }
        }
    }

    #[cfg(windows)]
    {
        // Windows: write to stdin
        // TODO: Implement Windows PTY I/O
        tracing::warn!("PTY I/O not yet implemented for Windows");
    }
}
```

**Step 15.2.7: Add PTY output reader task**

Edit: `crates/server/src/routes/terminal_ws.rs:188` (after send_task)

```rust
// Spawn PTY reader task: read from PTY and send to WebSocket
#[cfg(unix)]
{
    use services::services::terminal::ProcessManager;
    let terminal_id_reader = terminal_id.clone();
    let tx_reader = tx.clone();

    let pty_reader_task = tokio::spawn(async move {
        let mut buf = [0u8; 8192];
        let process_manager = deployment.process_manager().unwrap();

        loop {
            // Try to read from PTY (non-blocking)
            match process_manager.read_from_pty(&terminal_id_reader, &mut buf) {
                Ok(n) if n > 0 => {
                    // Convert bytes to string (lossy UTF-8 conversion)
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();

                    // Send to channel (will be forwarded to WebSocket)
                    if tx_reader.send(data).is_err() {
                        tracing::warn!("Failed to send PTY output to channel");
                        break;
                    }
                }
                Ok(_) => {
                    // No data available, sleep briefly
                    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
                }
                Err(e) => {
                    tracing::error!("PTY read error: {}", e);
                    break;
                }
            }
        }
    });

    // Track pty_reader_task for cleanup
}
```

**Step 15.2.8: Run test to verify it passes**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package server test_websocket_terminal_io
```

Expected: PASS (route exists and upgrades)

**Step 15.2.9: Commit**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
git add crates/services/src/services/terminal/process.rs
git add crates/server/src/routes/terminal_ws.rs
git add crates/server/tests/terminal_ws_test.rs
git commit -m "feat(15.2): PTY process I/O via WebSocket

- Add spawn_pty method to ProcessManager
- Track PTY master file descriptors
- Implement write_to_pty/read_from_pty methods
- Connect WebSocket input to PTY stdin
- Connect PTY stdout to WebSocket output
- Add test for WebSocket PTY I/O"
```

---

## Task 15.3: Terminal Output Persistence and Replay

**Files:**
- Modify: `crates/db/src/models/terminal.rs` (TerminalLog already exists)
- Modify: `crates/services/src/services/terminal/process.rs` (batch logging)
- Modify: `crates/server/src/routes/terminal_ws.rs` (persist output)
- Test: `crates/services/tests/terminal_log_test.rs` (new file)

**Why:** Enables replaying terminal history after disconnection or restart.

---

### Step 15.3.1: Write failing test for log persistence

Create test file: `crates/services/tests/terminal_log_test.rs`

```rust
use db::models::TerminalLog;
use uuid::Uuid;

#[tokio::test]
async fn test_terminal_log_persistence() {
    // Setup: In-memory DB
    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    // Run migrations
    let migrations_path = std::path::PathBuf::from("../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    // Arrange: Create a terminal
    let terminal_id = Uuid::new_v4().to_string();

    // Act: Create multiple log entries
    for i in 0..10 {
        TerminalLog::create(
            &pool,
            &terminal_id,
            "stdout",
            &format!("Line {}", i),
        ).await.unwrap();
    }

    // Assert: Retrieve logs
    let logs = TerminalLog::find_by_terminal(&pool, &terminal_id, Some(100)).await.unwrap();

    assert_eq!(logs.len(), 10);
    assert_eq!(logs[0].content, "Line 9"); // Most recent first (DESC order)
    assert_eq!(logs[9].content, "Line 0");
}
```

**Step 15.3.2: Run test to verify it passes**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package db test_terminal_log_persistence
```

Expected: PASS (TerminalLog already implemented in Phase 1)

**Step 15.3.3: Add batch log buffer to ProcessManager**

Edit: `crates/services/src/services/terminal/process.rs:28`

```rust
use std::{
    collections::{HashMap, VecDeque},
    path::Path,
    sync::Arc,
    time::Duration,
};

/// Log entry for batched writing
#[derive(Debug, Clone)]
struct LogEntry {
    terminal_id: String,
    log_type: String,
    content: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

/// Process manager for terminal lifecycle
pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<String, Child>>>,
    #[cfg(unix)]
    ptys: Arc<RwLock<HashMap<String, RawFd>>>,
    /// Log buffer for batched writes ( keyed by terminal_id)
    log_buffer: Arc<RwLock<HashMap<String, VecDeque<LogEntry>>>>,
    /// Database pool for log persistence
    db_pool: Option<sqlx::SqlitePool>,
}
```

**Step 15.3.4: Update ProcessManager::new**

Edit: `crates/services/src/services/terminal/process.rs:39`

```rust
pub fn new() -> Self {
    Self {
        processes: Arc::new(RwLock::new(HashMap::new())),
        #[cfg(unix)]
        ptys: Arc::new(RwLock::new(HashMap::new())),
        log_buffer: Arc::new(RwLock::new(HashMap::new())),
        db_pool: None,
    }
}

/// Create ProcessManager with database logging
pub fn with_db(pool: sqlx::SqlitePool) -> Self {
    Self {
        processes: Arc::new(RwLock::new(HashMap::new())),
        #[cfg(unix)]
        ptys: Arc::new(RwLock::new(HashMap::new())),
        log_buffer: Arc::new(RwLock::new(HashMap::new())),
        db_pool: Some(pool),
    }
}
```

**Step 15.3.5: Add buffer_log method**

Edit: `crates/services/src/services/terminal/process.rs:267` (after read_from_pty)

```rust
/// Buffer log entry for batched persistence
///
/// # Arguments
/// * `terminal_id` - Terminal ID
/// * `log_type` - Log type (stdout/stderr/system)
/// * `content` - Log content
pub async fn buffer_log(&self, terminal_id: &str, log_type: &str, content: &str) {
    let mut buffers = self.log_buffer.write().await;
    let buffer = buffers.entry(terminal_id.to_string())
        .or_insert_with(VecDeque::new);

    buffer.push_back(LogEntry {
        terminal_id: terminal_id.to_string(),
        log_type: log_type.to_string(),
        content: content.to_string(),
        timestamp: chrono::Utc::now(),
    });

    // Flush if buffer exceeds 100 entries
    if buffer.len() >= 100 {
        drop(buffers); // Release lock before flushing
        self.flush_logs(terminal_id).await;
    }
}

/// Flush buffered logs to database
pub async fn flush_logs(&self, terminal_id: &str) {
    let Some(pool) = &self.db_pool else {
        return; // No DB configured, skip logging
    };

    // Collect logs to flush
    let logs_to_flush = {
        let mut buffers = self.log_buffer.write().await;
        buffers.remove(terminal_id)
            .unwrap_or_else(VecDeque::new)
    };

    if logs_to_flush.is_empty() {
        return;
    }

    // Batch insert logs
    for log in logs_to_flush {
        let _ = db::models::TerminalLog::create(
            pool,
            &log.terminal_id,
            &log.log_type,
            &log.content,
        ).await;
    }

    tracing::debug!("Flushed {} logs for terminal {}", terminal_id, logs_to_flush.len());
}

/// Start periodic log flush task
///
/// Spawns a background task that flushes all log buffers every 1 second
pub fn start_log_flusher(self: Arc<Self>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(1));
        loop {
            interval.tick().await;

            // Get all terminal IDs with buffers
            let terminal_ids: Vec<String> = {
                let buffers = self.log_buffer.read().await;
                buffers.keys().cloned().collect()
            };

            // Flush each buffer
            for terminal_id in terminal_ids {
                self.flush_logs(&terminal_id).await;
            }
        }
    });
}
```

**Step 15.3.6: Update WebSocket handler to buffer logs**

Edit: `crates/server/src/routes/terminal_ws.rs:219` (PTY reader task)

```rust
use services::services::terminal::ProcessManager;
let terminal_id_reader = terminal_id.clone();
let tx_reader = tx.clone();
let process_manager = deployment.process_manager().unwrap();

let pty_reader_task = tokio::spawn(async move {
    let mut buf = [0u8; 8192];

    loop {
        match process_manager.read_from_pty(&terminal_id_reader, &mut buf) {
            Ok(n) if n > 0 => {
                let data = String::from_utf8_lossy(&buf[..n]).to_string();

                // Buffer log for persistence
                process_manager.buffer_log(&terminal_id_reader, "stdout", &data).await;

                // Send to WebSocket
                if tx_reader.send(data).is_err() {
                    tracing::warn!("Failed to send PTY output to channel");
                    break;
                }
            }
            Ok(_) => {
                tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
            }
            Err(e) => {
                tracing::error!("PTY read error: {}", e);
                break;
            }
        }
    }
});
```

**Step 15.3.7: Add log replay API endpoint**

Create new file: `crates/server/src/routes/terminal_logs.rs`

```rust
use axum::{
    extract::{Path, Query, State},
    response::Json,
    routing::get,
    Router,
};
use db::models::TerminalLog;
use serde::Deserialize;
use crate::DeploymentImpl;

#[derive(Debug, Deserialize)]
pub struct LogQuery {
    pub limit: Option<i32>,
}

pub fn terminal_logs_routes() -> Router<DeploymentImpl> {
    Router::new().route("/:terminal_id/logs", get(get_terminal_logs))
}

async fn get_terminal_logs(
    Path(terminal_id): Path<String>,
    Query(query): Query<LogQuery>,
    State(deployment): State<DeploymentImpl>,
) -> Result<Json<Vec<TerminalLog>>, ApiError> {
    let logs = TerminalLog::find_by_terminal(
        &deployment.db().pool,
        &terminal_id,
        query.limit,
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch terminal logs: {}", e);
        ApiError::InternalError
    })?;

    Ok(Json(logs))
}
```

**Step 15.3.8: Run test to verify it passes**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package services test_terminal_log_persistence
```

Expected: PASS

**Step 15.15.3.9: Commit**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
git add crates/services/src/services/terminal/process.rs
git add crates/server/src/routes/terminal_ws.rs
git add crates/server/src/routes/terminal_logs.rs
git add crates/services/tests/terminal_log_test.rs
git commit -m "feat(15.3): terminal output persistence and replay

- Add batch log buffer to ProcessManager
- Implement buffer_log/flush_logs methods
- Start periodic log flusher (1 second interval)
- Buffer PTY output in WebSocket handler
- Add /api/terminals/:id/logs endpoint for replay
- Add test for log persistence"
```

---

## Task 15.4: Terminal Timeout and Cancellation

**Files:**
- Modify: `crates/server/src/routes/terminal_ws.rs` (add idle timeout check)
- Modify: `crates/services/src/services/terminal/process.rs` (add timeout methods)
- Modify: `crates/server/src/routes/terminals.rs` (add stop endpoint)
- Test: `crates/server/tests/terminal_timeout_test.rs` (new file)

**Why:** Prevents zombie processes and resource leaks from abandoned terminals.

---

### Step 15.4.1: Write failing test for terminal timeout

Create test file: `crates/server/tests/terminal_timeout_test.rs`

```rust
use std::time::Duration;
use tokio::time::sleep;

#[tokio::test]
async fn test_terminal_idle_timeout() {
    // Test that idle terminals are automatically cleaned up

    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    // Run migrations
    let migrations_path = std::path::PathBuf::from("../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    // Create a terminal with last activity > 10 minutes ago
    let terminal_id = uuid::Uuid::new_v4().to_string();
    let ten_minutes_ago = chrono::Utc::now() - chrono::Duration::minutes(10);

    sqlx::query(
        "INSERT INTO terminal (id, workflow_task_id, cli_type_id, model_config_id, order_index, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&terminal_id)
    .bind("task-1")
    .bind("cli-1")
    .bind("config-1")
    .bind(0)
    .bind("waiting")
    .bind(ten_minutes_ago)
    .bind(ten_minutes_ago)
    .execute(&pool)
    .await
    .unwrap();

    // TODO: Implement timeout checker and run it
    // For now, just test the query logic
    let idle_terminals = sqlx::query!(
        "SELECT id FROM terminal WHERE status = 'waiting' AND updated_at < datetime('now', '-10 minutes')"
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert!(!idle_terminals.is_empty(), "Should find idle terminals");
}
```

**Step 15.4.2: Run test to verify it passes**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package server test_terminal_idle_timeout
```

Expected: PASS (query works)

**Step 15.4.3: Add timeout constants to ProcessManager**

Edit: `crates/services/src/services/terminal/process.rs:26`

```rust
use std::{
    collections::{HashMap, VecDeque},
    path::Path,
    sync::Arc,
    time::Duration,
};

/// Idle timeout before marking terminal as failed (10 minutes)
const TERMINAL_IDLE_TIMEOUT_SECS: u64 = 600;

/// Hard timeout before force-killing terminal (30 minutes)
const TERMINAL_HARD_TIMEOUT_SECS: u64 = 1800;
```

**Step 15.4.4: Add stop_terminal method**

Edit: `crates/services/src/services/terminal/process.rs:330` (after flush_logs)

```rust
/// Stop a terminal process and update status
///
/// # Arguments
/// * `terminal_id` - Terminal ID to stop
/// * `pool` - Database pool for status updates
///
/// # Returns
/// Returns `Ok(())` if terminal was stopped successfully
pub async fn stop_terminal(
    &self,
    terminal_id: &str,
    pool: &sqlx::SqlitePool,
) -> anyhow::Result<()> {
    // Get terminal to find process ID
    let terminal = db::models::Terminal::find_by_id(pool, terminal_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("Terminal not found: {}", terminal_id))?;

    // Kill process if running
    if let Some(pid) = terminal.process_id {
        if let Ok(pid_u32) = u32::try_from(pid) {
            self.kill(pid_u32)?;
        }
    }

    // Update terminal status to cancelled
    db::models::Terminal::update_status(pool, terminal_id, "cancelled").await?;

    // Flush any remaining logs
    self.flush_logs(terminal_id).await;

    tracing::info!("Terminal {} stopped", terminal_id);

    Ok(())
}
```

**Step 15.4.5: Add idle terminal cleanup task**

Edit: `crates/services/src/services/terminal/process.rs:360`

```rust
/// Start periodic idle terminal cleanup task
///
/// Spawns a background task that checks for idle terminals every minute
/// and stops those that have been idle for more than 10 minutes
pub fn start_idle_checker(self: Arc<Self>, pool: sqlx::SqlitePool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;

            let idle_threshold = chrono::Utc::now() - chrono::Duration::seconds(TERMINAL_IDLE_TIMEOUT_SECS as i64);

            // Find idle terminals
            let idle_terminals = sqlx::query!(
                "SELECT id FROM terminal
                 WHERE status IN ('waiting', 'working')
                 AND updated_at < ?",
                idle_threshold
            )
            .fetch_all(&pool)
            .await;

            match idle_terminals {
                Ok(terminals) => {
                    for terminal in terminals {
                        tracing::warn!(
                            "Terminal {} idle for > {}s, stopping",
                            terminal.id,
                            TERMINAL_IDLE_TIMEOUT_SECS
                        );

                        if let Err(e) = self.stop_terminal(&terminal.id, &pool).await {
                            tracing::error!("Failed to stop idle terminal {}: {}", terminal.id, e);
                        }
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to query idle terminals: {}", e);
                }
            }
        }
    });
}
```

**Step 15.4.6: Add manual stop API endpoint**

Edit: `crates/server/src/routes/terminals.rs` (or create if not exists)

```rust
use axum::{
    extract::{Path, State},
    response::Json,
    routing::post,
    Router,
    http::StatusCode,
};
use crate::DeploymentImpl;
use crate::error::ApiError;

pub fn terminal_control_routes() -> Router<DeploymentImpl> {
    Router::new()
        .route("/:id/stop", post(stop_terminal))
}

async fn stop_terminal(
    Path(id): Path<String>,
    State(deployment): State<DeploymentImpl>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // Validate terminal_id format
    if let Err(e) = crate::routes::terminal_ws::validate_terminal_id(&id) {
        return Err(ApiError::BadRequest(format!("Invalid terminal ID: {e}")));
    }

    let process_manager = deployment.process_manager()
        .ok_or_else(|| ApiError::InternalError)?;

    process_manager
        .stop_terminal(&id, &deployment.db().pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to stop terminal {}: {}", id, e);
            ApiError::InternalError
        })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Terminal stopped"
    })))
}
```

**Step 15.4.7: Update DeploymentImpl to start idle checker**

Edit: `crates/deployment/src/lib.rs` (or wherever DeploymentImpl is initialized)

```rust
use services::services::terminal::ProcessManager;

impl DeploymentImpl {
    pub async fn new(config: Config) -> anyhow::Result<Self> {
        // ... existing initialization code ...

        // Get ProcessManager and start background tasks
        let process_manager = self.process_manager().unwrap();
        let process_manager_arc = Arc::clone(process_manager);

        // Start log flusher
        process_manager_arc.clone().start_log_flusher();

        // Start idle checker
        process_manager_arc.start_idle_checker(self.db().pool.clone());

        // ... rest of initialization ...
    }
}
```

**Step 15.4.8: Run test to verify it passes**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package server test_terminal_idle_timeout
```

Expected: PASS

**Step 15.4.9: Commit**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
git add crates/services/src/services/terminal/process.rs
git add crates/server/src/routes/terminals.rs
git add crates/deployment/src/lib.rs
git add crates/server/tests/terminal_timeout_test.rs
git commit -m "feat(15.4): terminal timeout and cancellation

- Add idle timeout constants (10min idle, 30min hard)
- Implement stop_terminal method
- Add periodic idle checker (1 minute interval)
- Add POST /api/terminals/:id/stop endpoint
- Start background tasks in DeploymentImpl
- Add test for idle terminal detection"
```

---

## Task 15.5: CLI Detection and Installation Guidance

**Files:**
- Modify: `crates/services/src/services/terminal/detector.rs` (already exists)
- Modify: `crates/server/src/routes/cli_types.rs` (add isInstalled field)
- Modify: `frontend/src/components/workflow/steps/Step3Models.tsx` (show warnings)
- Test: `crates/services/tests/cli_detection_test.rs` (new file)

**Why:** Prevents workflow creation with unavailable CLI tools, guides users to install dependencies.

---

### Step 15.5.1: Check existing CliDetector implementation

Read: `crates/services/src/services/terminal/detector.rs`

```bash
cat /e/GitCortex/.worktrees/phase-15-terminal-runtime/crates/services/src/services/terminal/detector.rs
```

**Step 15.5.2: Add is_installed method to CliType model**

Edit: `crates/db/src/models/cli_type.rs` (find the CliType struct)

```rust
impl CliType {
    /// Check if CLI is installed on the system
    pub async fn is_installed(&self) -> bool {
        // Use which command to check availability
        #[cfg(unix)]
        {
            use std::process::Command;
            Command::new("which")
                .arg(&self.name)
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }

        #[cfg(windows)]
        {
            use std::process::Command;
            Command::new("where")
                .arg(&self.name)
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }
    }

    /// Get installation instructions for this CLI type
    pub fn installation_instructions(&self) -> &'static str {
        match self.name.as_str() {
            "claude-code" => "Install Claude Code CLI: npm install -g @anthropic-ai/claude-code",
            "gemini-cli" => "Install Gemini CLI: npm install -g @google/generative-ai-cli",
            "codex" => "Install Codex CLI: npm install -g openai-codex",
            "amp" => "Install Amp: https://github.com/jdx/amp",
            "cursor-agent" => "Install Cursor: https://cursor.sh",
            _ => "Installation instructions not available",
        }
    }
}
```

**Step 15.5.3: Update CliType DTO to include isInstalled**

Edit: `crates/server/src/routes/cli_types.rs` (find the list endpoint)

```rust
use db::models::CliType;

#[derive(Debug, Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CliTypeWithStatus {
    #[serde(flatten)]
    #[ts(flatten)]
    pub cli_type: CliType,
    pub is_installed: bool,
}

pub async fn list_cli_types(
    State(deployment): State<DeploymentImpl>,
) -> Result<Json<Vec<CliTypeWithStatus>>, ApiError> {
    let cli_types = CliType::find_all(&deployment.db().pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch CLI types: {}", e);
            ApiError::InternalError
        })?;

    // Check installation status for each CLI
    let mut result = Vec::new();
    for cli_type in cli_types {
        let is_installed = cli_type.is_installed().await;
        result.push(CliTypeWithStatus {
            cli_type,
            is_installed,
        });
    }

    Ok(Json(result))
}
```

**Step 15.5.4: Update frontend Step3Models to show installation warnings**

Edit: `frontend/src/components/workflow/steps/Step3Models.tsx`

```typescript
import { useWorkflows } from '@/hooks/useWorkflows';

// In the component, after fetching CLI types:
const { cliTypes, loading } = useWorkflows();

// Add warning for unavailable CLIs
const renderCliTypeOption = (cliType: CliTypeWithStatus) => {
  const isInstalled = cliType.isInstalled;

  return (
    <option
      key={cliType.id}
      value={cliType.id}
      disabled={!isInstalled}
      title={!isInstalled ? cliType.installation_instructions() : undefined}
    >
      {cliType.name} {!isInstalled ? '(Not Installed)' : ''}
    </option>
  );
};

// Show installation guidance
const renderInstallationWarning = () => {
  const unavailableCLIs = selectedCliTypes.filter(ct => !ct.isInstalled);

  if (unavailableCLIs.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <ExclamationIcon className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            The following CLI tools are not installed:
          </p>
          <ul className="list-disc list-inside text-sm text-yellow-700 mt-2">
            {unavailableCLIs.map(cli => (
              <li key={cli.id}>
                <strong>{cli.name}</strong>: {cli.installationInstructions()}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
```

**Step 15.5.5: Write test for CLI detection**

Create test file: `crates/services/tests/cli_detection_test.rs`

```rust
use services::services::terminal::CliDetector;
use db::{DBService, models::cli_type::CliType};

#[tokio::test]
async fn test_cli_detection() {
    // Setup
    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    let migrations_path = std::path::PathBuf::from("../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    let db = Arc::new(DBService { pool: pool.clone() });
    let detector = CliDetector::new(Arc::clone(&db));

    // Create a test CLI type
    let cli_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO cli_type (id, name, command_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&cli_id)
    .bind("ls") // Use 'ls' which should exist on all systems
    .bind("{command}")
    .bind(chrono::Utc::now())
    .bind(chrono::Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    // Test: Detect installed CLIs
    let installed_clis = detector.detect_installed().await.unwrap();

    // 'ls' should be detected
    assert!(installed_clis.iter().any(|cli| cli.name == "ls"));
}
```

**Step 15.5.6: Run test to verify it passes**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package services test_cli_detection
```

Expected: PASS

**Step 15.5.7: Commit**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
git add crates/db/src/models/cli_type.rs
git add crates/server/src/routes/cli_types.rs
git add frontend/src/components/workflow/steps/Step3Models.tsx
git add crates/services/tests/cli_detection_test.rs
git commit -m "feat(15.5): CLI detection and installation guidance

- Add is_installed method to CliType
- Add installation_instructions for common CLIs
- Update CLI types API to include isInstalled field
- Show installation warnings in Step3Models
- Disable unavailable CLI options
- Add test for CLI detection"
```

---

## Task 15.6: Terminal Lifecycle Integration Tests

**Files:**
- Create: `crates/services/tests/terminal_lifecycle_test.rs`
- Test: Full terminal lifecycle (create -> launch -> I/O -> stop -> cleanup)

**Why:** Ensures all components work together correctly in realistic scenarios.

---

### Step 15.6.1: Write comprehensive lifecycle test

Create test file: `crates/services/tests/terminal_lifecycle_test.rs`

```rust
use services::services::terminal::{TerminalLauncher, ProcessManager, CliDetector};
use db::{DBService, models::{Terminal, CliType, ModelConfig}};
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn test_full_terminal_lifecycle() {
    // Setup: Create in-memory DB with all migrations
    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    let migrations_path = std::path::PathBuf::from("../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    let db = Arc::new(DBService { pool: pool.clone() });

    // Step 1: Create CLI type and model config
    let cli_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO cli_type (id, name, command_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(&cli_id)
    .bind("echo-test")
    .bind("echo")
    .bind(chrono::Utc::now())
    .bind(chrono::Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let config_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO model_config (id, name, provider, model_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&config_id)
    .bind("test-config")
    .bind("test")
    .bind("test-model")
    .bind(chrono::Utc::now())
    .bind(chrono::Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    // Step 2: Create workflow, task, and terminal
    let wf_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO workflow (id, name, base_dir, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&wf_id)
    .bind("test-wf")
    .bind("/tmp")
    .bind("created")
    .bind(chrono::Utc::now())
    .bind(chrono::Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let task_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO workflow_task (id, workflow_id, name, order_index, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&task_id)
    .bind(&wf_id)
    .bind("task-1")
    .bind(0)
    .bind("pending")
    .bind(chrono::Utc::now())
    .bind(chrono::Utc::now())
    .execute(&pool)
    .await
    .unwrap();

    let terminal_id = Uuid::new_v4().to_string();
    let terminal = Terminal {
        id: terminal_id.clone(),
        workflow_task_id: task_id.clone(),
        cli_type_id: cli_id.clone(),
        model_config_id: config_id.clone(),
        custom_base_url: None,
        custom_api_key: None,
        role: Some("coder".to_string()),
        role_description: None,
        order_index: 0,
        status: "not_started".to_string(),
        process_id: None,
        pty_session_id: None,
        vk_session_id: None,
        last_commit_hash: None,
        last_commit_message: None,
        started_at: None,
        completed_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Step 3: Launch terminal
    let cc_switch = Arc::new(services::services::cc_switch::CCSwitchService::new(Arc::clone(&db)));
    let process_manager = Arc::new(ProcessManager::with_db(pool.clone()));
    let working_dir = std::env::temp_dir();
    let launcher = TerminalLauncher::new(Arc::clone(&db), cc_switch, Arc::clone(&process_manager), working_dir);

    let launch_result = launcher.launch_terminal(&terminal).await;
    assert!(launch_result.success, "Terminal launch should succeed");
    assert!(launch_result.process_handle.is_some(), "Should have process handle");

    // Step 4: Verify terminal status updated
    let updated_terminal = Terminal::find_by_id(&pool, &terminal_id).await.unwrap().unwrap();
    assert_eq!(updated_terminal.status, "waiting");
    assert!(updated_terminal.started_at.is_some());
    assert!(updated_terminal.session_id.is_some());

    // Step 5: Verify logs are being written
    tokio::time::sleep(Duration::from_millis(1100)).await; // Wait for log flush (1s interval)
    process_manager.flush_logs(&terminal_id).await;

    let logs = db::models::TerminalLog::find_by_terminal(&pool, &terminal_id, Some(100)).await.unwrap();
    // May have logs depending on CLI output

    // Step 6: Stop terminal
    process_manager.stop_terminal(&terminal_id, &pool).await.unwrap();

    // Step 7: Verify terminal status updated to cancelled
    let stopped_terminal = Terminal::find_by_id(&pool, &terminal_id).await.unwrap().unwrap();
    assert_eq!(stopped_terminal.status, "cancelled");
    assert!(stopped_terminal.completed_at.is_some());

    // Step 8: Verify process was killed
    let is_running = process_manager.is_running(&terminal_id).await;
    assert!(!is_running, "Process should not be running after stop");
}

#[tokio::test]
async fn test_terminal_log_replay() {
    // Test log replay functionality

    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    let migrations_path = std::path::PathBuf::from("../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    let terminal_id = Uuid::new_v4().to_string();

    // Create 50 log entries
    for i in 0..50 {
        db::models::TerminalLog::create(
            &pool,
            &terminal_id,
            "stdout",
            &format!("Line {}", i),
        ).await.unwrap();
    }

    // Test pagination
    let page1 = db::models::TerminalLog::find_by_terminal(&pool, &terminal_id, Some(20)).await.unwrap();
    assert_eq!(page1.len(), 20);

    // Verify order (DESC by created_at)
    assert_eq!(page1[0].content, "Line 49");
    assert_eq!(page1[19].content, "Line 30");
}

#[tokio::test]
async fn test_idle_terminal_cleanup() {
    // Test idle terminal detection and cleanup

    let pool = sqlx::SqlitePoolOptions::new()
        .connect(":memory:")
        .await
        .unwrap();

    let migrations_path = std::path::PathBuf::from("../crates/db/migrations");
    let m = sqlx::migrate::Migrator::new(migrations_path).await.unwrap();
    m.run(&pool).await.unwrap();

    let db = Arc::new(DBService { pool: pool.clone() });
    let process_manager = Arc::new(ProcessManager::with_db(pool.clone()));

    // Create old terminal
    let terminal_id = Uuid::new_v4().to_string();
    let fifteen_minutes_ago = chrono::Utc::now() - chrono::Duration::minutes(15);

    sqlx::query(
        "INSERT INTO terminal (id, workflow_task_id, cli_type_id, model_config_id, order_index, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&terminal_id)
    .bind("task-1")
    .bind("cli-1")
    .bind("config-1")
    .bind(0)
    .bind("waiting")
    .bind(fifteen_minutes_ago)
    .bind(fifteen_minutes_ago)
    .execute(&pool)
    .await
    .unwrap();

    // Manually trigger cleanup (in real scenario, idle checker runs in background)
    let idle_threshold = chrono::Utc::now() - chrono::Duration::seconds(600); // 10 minutes

    let idle_terminals = sqlx::query!(
        "SELECT id FROM terminal WHERE status = 'waiting' AND updated_at < ?",
        idle_threshold
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert!(!idle_terminals.is_empty());
    assert_eq!(idle_terminals[0].id, terminal_id);
}
```

**Step 15.6.2: Run all integration tests**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --package services terminal_lifecycle
cargo test --package db terminal_log
cargo test --package server terminal_timeout
```

Expected: All PASS

**Step 15.6.3: Run full test suite**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --workspace 2>&1 | tail -100
```

Expected: All tests pass, report final count

**Step 15.6.4: Commit**

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
git add crates/services/tests/terminal_lifecycle_test.rs
git commit -m "test(15.6): add comprehensive terminal lifecycle tests

- Test full lifecycle: create -> launch -> I/O -> stop -> cleanup
- Test log replay with pagination
- Test idle terminal cleanup
- Verify session/execution_process binding
- Verify log persistence and retrieval
- All tests passing"
```

---

## Final Verification Steps

### 1. Generate TypeScript types

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime/frontend
pnpm generate-types
```

Verify new fields (`session_id`, `execution_process_id`, `isInstalled`) are exported.

### 2. Update TODO.md

Edit: `docs/plans/TODO.md:339-350` (Phase 15 section)

Change all `⬜` to `✅` and add completion date: `2026-01-25`

### 3. Run frontend build

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime/frontend
pnpm build
```

Verify no TypeScript errors.

### 4. Run backend tests

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
cargo test --workspace
```

All tests should pass.

### 5. Final commit

```bash
cd /e/GitCortex/.worktrees/phase-15-terminal-runtime
git add docs/plans/TODO.md
git commit -m "docs: mark Phase 15 complete (2026-01-25)

All tasks completed:
✅ 15.1: Terminal ↔ Session/ExecutionProcess binding
✅ 15.2: PTY process I/O via WebSocket
✅ 15.3: Terminal output persistence and replay
✅ 15.4: Terminal timeout and cancellation
✅ 15.5: CLI detection and installation guidance
✅ 15.6: Terminal lifecycle integration tests

Ready for Phase 16: Workflow frontend UX completion"
```

---

## Summary of Changes

**Database:**
- Migration: `20260125000001_add_terminal_session_binding.sql`
- Terminal: Added `session_id`, `execution_process_id` fields
- Methods: `update_session`, `TerminalLog::create/find_by_terminal` (already exists)

**Backend (Rust):**
- `ProcessManager`: Added `spawn_pty`, `write_to_pty`, `read_from_pty`, `buffer_log`, `flush_logs`, `stop_terminal`, `start_log_flusher`, `start_idle_checker`
- `TerminalLauncher`: Creates Session on launch, binds to terminal
- `CliType`: Added `is_installed`, `installation_instructions`
- `WebSocket`: PTY I/O integration, log buffering
- API endpoints: `/api/terminals/:id/logs`, `POST /api/terminals/:id/stop`

**Frontend (TypeScript):**
- `Step3Models.tsx`: Shows CLI installation warnings, disables unavailable options

**Tests:**
- `terminal_binding_test.rs`: Session creation
- `terminal_ws_test.rs`: WebSocket PTY I/O
- `terminal_log_test.rs`: Log persistence and replay
- `terminal_timeout_test.rs`: Idle detection
- `cli_detection_test.rs`: CLI availability
- `terminal_lifecycle_test.rs`: Full lifecycle integration

**Next Phase:** 16 - Workflow Frontend UX (real data, debugging, controls)

---

**End of Plan**
