//! Process management with PTY support
//!
//! Manages terminal process lifecycle including spawning, monitoring, and cleanup.
//! Uses portable-pty for cross-platform PTY support (Windows ConPTY, Unix PTY).

use std::{
    collections::HashMap,
    io::{Read, Write},
    path::Path,
    sync::{Arc, Mutex},
};

use db::DBService;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// PTY Size Configuration
// ============================================================================

/// Default terminal columns
pub const DEFAULT_COLS: u16 = 80;

/// Default terminal rows
pub const DEFAULT_ROWS: u16 = 24;

// ============================================================================
// Process Handle Types
// ============================================================================

/// PTY reader wrapper for async reading
pub struct PtyReader(Box<dyn Read + Send>);

impl PtyReader {
    /// Read bytes from PTY (blocking)
    pub fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        self.0.read(buf)
    }
}

/// PTY writer wrapper for async writing
pub struct PtyWriter(Box<dyn Write + Send>);

impl PtyWriter {
    /// Write bytes to PTY (blocking)
    pub fn write_all(&mut self, buf: &[u8]) -> std::io::Result<()> {
        self.0.write_all(buf)
    }

    /// Flush PTY writer
    pub fn flush(&mut self) -> std::io::Result<()> {
        self.0.flush()
    }
}

/// Process handle for tracking spawned PTY processes
pub struct ProcessHandle {
    /// Process ID
    pub pid: u32,
    /// Unique session identifier
    pub session_id: String,
    /// Associated terminal ID
    pub terminal_id: String,
    /// PTY reader (for WebSocket forwarding) - single stream, no stdout/stderr separation
    pub reader: Option<PtyReader>,
    /// Shared PTY writer (for WebSocket input) - wrapped in Arc<Mutex> for reconnection support
    pub writer: Option<Arc<Mutex<PtyWriter>>>,
}

// Implement Debug manually since portable-pty types don't implement Debug
impl std::fmt::Debug for ProcessHandle {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ProcessHandle")
            .field("pid", &self.pid)
            .field("session_id", &self.session_id)
            .field("terminal_id", &self.terminal_id)
            .field("reader", &self.reader.is_some())
            .field("writer", &self.writer.is_some())
            .finish()
    }
}

// ============================================================================
// Tracked Process
// ============================================================================

/// Tracked process with PTY master and child handles
struct TrackedProcess {
    /// Child process for lifecycle management
    child: Box<dyn Child + Send + Sync>,
    /// PTY master for I/O and resize operations (wrapped in Mutex for Sync)
    master: Mutex<Box<dyn MasterPty + Send>>,
    /// Shared PTY writer (initialized on first get_handle call, then reused for reconnections)
    shared_writer: Option<Arc<Mutex<PtyWriter>>>,
}

// ============================================================================
// Process Manager
// ============================================================================

/// Process manager for terminal lifecycle with PTY support
pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<String, TrackedProcess>>>,
}

impl ProcessManager {
    /// Creates a new ProcessManager instance
    pub fn new() -> Self {
        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Spawns a new terminal process with PTY
    ///
    /// Creates a new PTY and spawns the shell process attached to it.
    /// The process is tracked by its terminal ID and can be monitored or terminated later.
    ///
    /// # Arguments
    ///
    /// * `terminal_id` - Unique identifier for this terminal session
    /// * `shell` - The shell command to spawn (e.g., "powershell", "bash")
    /// * `working_dir` - Directory where the process will run
    /// * `cols` - Initial terminal width in columns
    /// * `rows` - Initial terminal height in rows
    ///
    /// # Returns
    ///
    /// Returns a `ProcessHandle` containing the PID and session ID.
    pub async fn spawn_pty(
        &self,
        terminal_id: &str,
        shell: &str,
        working_dir: &Path,
        cols: u16,
        rows: u16,
    ) -> anyhow::Result<ProcessHandle> {
        // Create PTY system
        let pty_system = native_pty_system();

        // Configure PTY size
        let size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        // Open PTY pair (master + slave)
        let pair = pty_system
            .openpty(size)
            .map_err(|e| anyhow::anyhow!("Failed to open PTY: {e}"))?;

        // Build command
        // On Windows, use cmd.exe /c to run commands so that .cmd/.bat files are found
        #[cfg(windows)]
        let mut cmd = {
            let mut c = CommandBuilder::new("cmd.exe");
            c.arg("/c");
            c.arg(shell);
            c
        };
        #[cfg(not(windows))]
        let mut cmd = CommandBuilder::new(shell);
        cmd.cwd(working_dir);

        // Set environment variables for proper terminal behavior
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // UTF-8 encoding for Unix
        #[cfg(unix)]
        {
            cmd.env("LANG", "C.UTF-8");
            cmd.env("LC_ALL", "C.UTF-8");
        }

        // Spawn child process on slave PTY
        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| anyhow::anyhow!("Failed to spawn terminal process: {e}"))?;

        let pid = child.process_id().unwrap_or(0);
        let session_id = Uuid::new_v4().to_string();

        // Wait a short time and check if the process is still alive
        // This catches cases where the command fails immediately (e.g., not found, permission denied)
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        match child.try_wait() {
            Ok(Some(status)) => {
                return Err(anyhow::anyhow!(
                    "Terminal process exited immediately with status: {:?}. The CLI may not be installed correctly.",
                    status
                ));
            }
            Ok(None) => {
                // Process is still running, good
            }
            Err(e) => {
                return Err(anyhow::anyhow!(
                    "Failed to check terminal process status: {e}"
                ));
            }
        }

        // Store tracked process
        let mut processes = self.processes.write().await;
        processes.insert(
            terminal_id.to_string(),
            TrackedProcess {
                child,
                master: Mutex::new(pair.master),
                shared_writer: None,
            },
        );

        tracing::info!(
            terminal_id = %terminal_id,
            pid = pid,
            shell = %shell,
            "PTY process spawned successfully"
        );

        Ok(ProcessHandle {
            pid,
            session_id,
            terminal_id: terminal_id.to_string(),
            reader: None,
            writer: None,
        })
    }

    /// Resize terminal PTY
    ///
    /// # Arguments
    ///
    /// * `terminal_id` - Terminal ID to resize
    /// * `cols` - New width in columns
    /// * `rows` - New height in rows
    pub async fn resize(&self, terminal_id: &str, cols: u16, rows: u16) -> anyhow::Result<()> {
        let processes = self.processes.read().await;

        if let Some(tracked) = processes.get(terminal_id) {
            let size = PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            };

            let master = tracked
                .master
                .lock()
                .map_err(|e| anyhow::anyhow!("Failed to lock PTY master: {e}"))?;

            master
                .resize(size)
                .map_err(|e| anyhow::anyhow!("Failed to resize PTY: {e}"))?;

            tracing::debug!(
                terminal_id = %terminal_id,
                cols = cols,
                rows = rows,
                "PTY resized"
            );

            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal not found: {terminal_id}"))
        }
    }

    /// Terminates a process by its PID
    ///
    /// Sends a termination signal to the process with the given PID.
    /// On Unix, sends SIGTERM. On Windows, uses taskkill /F.
    pub fn kill(&self, pid: u32) -> anyhow::Result<()> {
        #[cfg(unix)]
        {
            use nix::{
                sys::signal::{self, Signal},
                unistd::Pid,
            };
            signal::kill(Pid::from_raw(pid as i32), Signal::SIGTERM)
                .map_err(|e| anyhow::anyhow!("Failed to kill process {pid}: {e}"))?;
        }

        #[cfg(windows)]
        {
            let output = std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .output()
                .map_err(|e| anyhow::anyhow!("Failed to execute taskkill: {e}"))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(anyhow::anyhow!("taskkill failed: {stderr}"));
            }
        }

        Ok(())
    }

    /// Kill terminal by terminal ID
    pub async fn kill_terminal(&self, terminal_id: &str) -> anyhow::Result<()> {
        let mut processes = self.processes.write().await;

        if let Some(mut tracked) = processes.remove(terminal_id) {
            // Try to kill the child process
            if let Err(e) = tracked.child.kill() {
                tracing::warn!(
                    terminal_id = %terminal_id,
                    error = %e,
                    "Failed to kill child process"
                );
            }

            tracing::info!(terminal_id = %terminal_id, "Terminal killed");
            Ok(())
        } else {
            Err(anyhow::anyhow!("Terminal not found: {terminal_id}"))
        }
    }

    /// Check if a terminal process is running
    pub async fn is_running(&self, terminal_id: &str) -> bool {
        let processes = self.processes.read().await;
        processes.contains_key(terminal_id)
    }

    /// Lists all currently tracked terminal IDs
    pub async fn list_running(&self) -> Vec<String> {
        let processes = self.processes.read().await;
        processes.keys().cloned().collect()
    }

    /// Removes dead processes from tracking
    pub async fn cleanup(&self) {
        let mut processes = self.processes.write().await;

        // Collect IDs of dead processes
        let dead_ids: Vec<String> = processes
            .iter_mut()
            .filter_map(|(id, tracked)| {
                match tracked.child.try_wait() {
                    Ok(Some(_)) => Some(id.clone()), // Process exited
                    _ => None,                       // Still running or error
                }
            })
            .collect();

        // Remove dead processes
        for id in dead_ids {
            processes.remove(&id);
            tracing::debug!(terminal_id = %id, "Removed dead process from tracking");
        }
    }

    /// Get process handle by terminal ID
    ///
    /// Returns a ProcessHandle containing the PTY reader/writer for the terminal process.
    /// This method supports multiple calls for WebSocket reconnection scenarios:
    /// - Reader is cloned on each call (portable-pty supports multiple readers)
    /// - Writer is shared via Arc<Mutex> (initialized on first call, then reused)
    pub async fn get_handle(&self, terminal_id: &str) -> Option<ProcessHandle> {
        let mut processes = self.processes.write().await;

        if let Some(tracked) = processes.get_mut(terminal_id) {
            let session_id = Uuid::new_v4().to_string();

            // Lock the master to get reader/writer
            let master = match tracked.master.lock() {
                Ok(m) => m,
                Err(e) => {
                    tracing::error!(
                        terminal_id = %terminal_id,
                        error = %e,
                        "Failed to lock PTY master"
                    );
                    return None;
                }
            };

            // Clone reader on each call (portable-pty supports multiple readers)
            let reader = match master.try_clone_reader() {
                Ok(r) => Some(PtyReader(r)),
                Err(e) => {
                    tracing::error!(
                        terminal_id = %terminal_id,
                        error = %e,
                        "Failed to clone PTY reader"
                    );
                    None
                }
            };

            // Initialize shared writer on first call, then reuse for reconnections
            if tracked.shared_writer.is_none() {
                match master.take_writer() {
                    Ok(w) => {
                        tracked.shared_writer = Some(Arc::new(Mutex::new(PtyWriter(w))));
                        tracing::debug!(
                            terminal_id = %terminal_id,
                            "Initialized shared PTY writer"
                        );
                    }
                    Err(e) => {
                        tracing::error!(
                            terminal_id = %terminal_id,
                            error = %e,
                            "Failed to take PTY writer"
                        );
                    }
                }
            }

            // Clone the Arc reference for the caller
            let writer = tracked.shared_writer.as_ref().map(Arc::clone);

            // Drop the lock before accessing child
            drop(master);

            // Get PID from child
            let pid = tracked.child.process_id().unwrap_or(0);

            Some(ProcessHandle {
                pid,
                session_id,
                terminal_id: terminal_id.to_string(),
                reader,
                writer,
            })
        } else {
            None
        }
    }
}

impl Default for ProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Terminal Logger
// ============================================================================

/// Batch logger for terminal output
///
/// Batches log lines and flushes them every second to reduce I/O overhead.
pub const DEFAULT_MAX_BUFFER_SIZE: usize = 1000;

pub struct TerminalLogger {
    buffer: Arc<RwLock<Vec<String>>>,
    flush_interval_secs: u64,
    max_buffer_size: usize,
    db: Arc<DBService>,
    terminal_id: String,
    log_type: String,
}

impl TerminalLogger {
    pub fn new(
        db: Arc<DBService>,
        terminal_id: impl Into<String>,
        log_type: impl Into<String>,
        flush_interval_secs: u64,
    ) -> Self {
        Self::with_max_buffer_size(
            db,
            terminal_id,
            log_type,
            flush_interval_secs,
            DEFAULT_MAX_BUFFER_SIZE,
        )
    }

    pub fn with_max_buffer_size(
        db: Arc<DBService>,
        terminal_id: impl Into<String>,
        log_type: impl Into<String>,
        flush_interval_secs: u64,
        max_buffer_size: usize,
    ) -> Self {
        Self {
            buffer: Arc::new(RwLock::new(Vec::new())),
            flush_interval_secs,
            max_buffer_size: max_buffer_size.max(1),
            db,
            terminal_id: terminal_id.into(),
            log_type: log_type.into(),
        }
        .start_flush_task()
    }

    async fn persist_entries(
        db: &DBService,
        terminal_id: &str,
        log_type: &str,
        entries: &[String],
    ) -> anyhow::Result<()> {
        use db::models::terminal::TerminalLog;
        for line in entries {
            TerminalLog::create(&db.pool, terminal_id, log_type, line).await?;
        }
        Ok(())
    }

    fn start_flush_task(self) -> Self {
        let buffer = Arc::clone(&self.buffer);
        let interval_secs = self.flush_interval_secs;
        let db = Arc::clone(&self.db);
        let terminal_id = self.terminal_id.clone();
        let log_type = self.log_type.clone();

        tokio::spawn(async move {
            let mut interval =
                tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));
            loop {
                interval.tick().await;
                let entries = {
                    let mut buffer = buffer.write().await;
                    if buffer.is_empty() {
                        Vec::new()
                    } else {
                        buffer.drain(..).collect::<Vec<_>>()
                    }
                };

                if entries.is_empty() {
                    continue;
                }

                if let Err(e) =
                    Self::persist_entries(&db, &terminal_id, &log_type, &entries).await
                {
                    tracing::error!("Failed to persist terminal logs: {e}");
                    let mut buffer = buffer.write().await;
                    buffer.splice(0..0, entries);
                }
            }
        });

        self
    }

    pub async fn append(&self, line: &str) {
        let entries = {
            let mut buffer = self.buffer.write().await;
            buffer.push(line.to_string());

            if buffer.len() < self.max_buffer_size {
                return;
            }

            buffer.drain(..).collect::<Vec<_>>()
        };

        if let Err(e) =
            Self::persist_entries(&self.db, &self.terminal_id, &self.log_type, &entries).await
        {
            tracing::error!("Failed to persist terminal logs: {e}");
            let mut buffer = self.buffer.write().await;
            buffer.splice(0..0, entries);
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_process_manager_new() {
        let manager = ProcessManager::new();
        let running = manager.list_running().await;
        assert_eq!(running.len(), 0, "New manager should have no processes");
    }

    #[tokio::test]
    async fn test_process_manager_default() {
        let manager = ProcessManager::default();
        let running = manager.list_running().await;
        assert_eq!(running.len(), 0);
    }

    #[tokio::test]
    async fn test_spawn_pty_creates_process() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        // Use platform-specific shell
        #[cfg(windows)]
        let shell = "cmd.exe";
        #[cfg(unix)]
        let shell = "sh";

        let result = manager
            .spawn_pty("test-terminal", shell, temp_dir.path(), 80, 24)
            .await;

        assert!(result.is_ok(), "Spawn should succeed: {:?}", result.err());
        let handle = result.unwrap();
        assert_eq!(handle.terminal_id, "test-terminal");
        assert!(!handle.session_id.is_empty());

        // Cleanup
        let _ = manager.kill_terminal("test-terminal").await;
    }

    #[tokio::test]
    async fn test_get_handle_returns_pty_handles() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        #[cfg(windows)]
        let shell = "cmd.exe";
        #[cfg(unix)]
        let shell = "sh";

        let _ = manager
            .spawn_pty("test-terminal", shell, temp_dir.path(), 80, 24)
            .await;

        // First call should return handles
        let handle1 = manager.get_handle("test-terminal").await;
        assert!(handle1.is_some());
        let handle1 = handle1.unwrap();
        assert!(handle1.reader.is_some());
        assert!(handle1.writer.is_some());

        // Second call should also return handles (reader cloned, writer shared)
        // This supports WebSocket reconnection scenarios
        let handle2 = manager.get_handle("test-terminal").await;
        assert!(handle2.is_some());
        let handle2 = handle2.unwrap();
        assert!(handle2.reader.is_some());
        assert!(handle2.writer.is_some());

        // Verify that writers are the same Arc (shared)
        let writer1 = handle1.writer.as_ref().unwrap();
        let writer2 = handle2.writer.as_ref().unwrap();
        assert!(Arc::ptr_eq(writer1, writer2), "Writers should be shared via Arc");

        // Cleanup
        let _ = manager.kill_terminal("test-terminal").await;
    }

    #[tokio::test]
    async fn test_resize_pty() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        #[cfg(windows)]
        let shell = "cmd.exe";
        #[cfg(unix)]
        let shell = "sh";

        let _ = manager
            .spawn_pty("test-terminal", shell, temp_dir.path(), 80, 24)
            .await;

        // Resize should succeed
        let result = manager.resize("test-terminal", 120, 40).await;
        assert!(result.is_ok());

        // Cleanup
        let _ = manager.kill_terminal("test-terminal").await;
    }

    #[tokio::test]
    async fn test_get_handle_for_nonexistent_terminal() {
        let manager = ProcessManager::new();
        let handle = manager.get_handle("non-existent").await;
        assert!(handle.is_none());
    }
}
