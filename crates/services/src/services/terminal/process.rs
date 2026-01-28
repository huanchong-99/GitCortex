//! Process management
//!
//! Manages terminal process lifecycle including spawning, monitoring, and cleanup.

use std::{collections::HashMap, path::Path, sync::Arc};

use tokio::{
    process::{Child, Command, ChildStdout, ChildStderr, ChildStdin},
    sync::RwLock,
};
use uuid::Uuid;

/// Terminal idle timeout in seconds (10 minutes)
///
/// Sessions without user activity (input/output) for this duration
/// will be automatically terminated to free resources.
const TERMINAL_IDLE_TIMEOUT_SECS: u64 = 600;

/// Terminal hard timeout in seconds (30 minutes)
///
/// Maximum lifetime for any terminal session, regardless of activity.
/// After this duration, the session will be forcibly terminated.
const TERMINAL_HARD_TIMEOUT_SECS: u64 = 1800;

/// Process handle for tracking spawned processes
#[derive(Debug)]
pub struct ProcessHandle {
    /// Process ID
    pub pid: u32,
    /// Unique session identifier
    pub session_id: String,
    /// Associated terminal ID
    pub terminal_id: String,
    /// Stdout reader (for WebSocket forwarding)
    pub stdout: Option<ChildStdout>,
    /// Stderr reader (for WebSocket forwarding)
    pub stderr: Option<ChildStderr>,
    /// Stdin writer (for WebSocket input)
    pub stdin: Option<ChildStdin>,
}

/// Tracked process with child and I/O handles
#[derive(Debug)]
struct TrackedProcess {
    /// Child process for lifecycle management
    child: Child,
    /// Stdout reader (for WebSocket forwarding)
    stdout: Option<ChildStdout>,
    /// Stderr reader (for WebSocket forwarding)
    stderr: Option<ChildStderr>,
    /// Stdin writer (for WebSocket input)
    stdin: Option<ChildStdin>,
}

/// Process manager for terminal lifecycle
pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<String, TrackedProcess>>>,
}

impl ProcessManager {
    /// Creates a new ProcessManager instance
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::ProcessManager;
    ///
    /// let manager = ProcessManager::new();
    /// ```
    pub fn new() -> Self {
        Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Spawns a new terminal process
    ///
    /// Creates a new process with the given command, running in the specified working directory.
    /// The process is tracked by its terminal ID and can be monitored or terminated later.
    ///
    /// # Arguments
    ///
    /// * `terminal_id` - Unique identifier for this terminal session
    /// * `cmd` - The command to spawn
    /// * `working_dir` - Directory where the process will run
    ///
    /// # Returns
    ///
    /// Returns a `ProcessHandle` containing the PID, session ID, and terminal ID.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The process fails to spawn
    /// - The process ID cannot be retrieved after spawning
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use tokio::process::Command;
    /// use services::services::terminal::ProcessManager;
    /// use std::path::Path;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> anyhow::Result<()> {
    /// let manager = ProcessManager::new();
    /// let cmd = Command::new("echo");
    /// let handle = manager.spawn("my-terminal", cmd, Path::new("/tmp")).await?;
    /// # Ok(())
    /// # }
    /// ```
    pub async fn spawn(
        &self,
        terminal_id: &str,
        mut cmd: Command,
        working_dir: &Path,
    ) -> anyhow::Result<ProcessHandle> {
        cmd.current_dir(working_dir);

        // Configure standard I/O
        cmd.stdin(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| anyhow::anyhow!("Failed to spawn terminal process: {e}"))?;
        let pid = child
            .id()
            .ok_or_else(|| anyhow::anyhow!("Failed to get process ID"))?;
        let session_id = Uuid::new_v4().to_string();

        // Extract I/O handles for PTY communication
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let stdin = child.stdin.take();

        let mut processes = self.processes.write().await;
        processes.insert(terminal_id.to_string(), TrackedProcess {
            child,
            stdout,
            stderr,
            stdin,
        });

        Ok(ProcessHandle {
            pid,
            session_id,
            terminal_id: terminal_id.to_string(),
            stdout: None, // Will be provided by get_handle
            stderr: None,
            stdin: None,
        })
    }

    /// Terminates a process by its PID
    ///
    /// Sends a termination signal to the process with the given PID.
    /// On Unix, sends SIGTERM. On Windows, uses taskkill /F.
    ///
    /// # Arguments
    ///
    /// * `pid` - Process ID to terminate
    ///
    /// # Returns
    ///
    /// Returns `Ok(())` if the termination signal was sent successfully.
    ///
    /// # Errors
    ///
    /// Returns an error if the termination signal fails to send.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::ProcessManager;
    ///
    /// # #[tokio::main]
    /// # async fn main() -> anyhow::Result<()> {
    /// let manager = ProcessManager::new();
    /// manager.kill(12345)?;
    /// # Ok(())
    /// # }
    /// ```
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
}

/// Batch logger for terminal output
///
/// Batches log lines and flushes them every second to reduce I/O overhead.
/// Uses an in-memory buffer and periodic background task for efficient logging.
pub struct TerminalLogger {
    /// Batch buffer for log lines
    buffer: Arc<RwLock<Vec<String>>>,
    /// Flush interval in seconds
    flush_interval_secs: u64,
}

impl TerminalLogger {
    /// Creates a new TerminalLogger with specified flush interval
    ///
    /// # Arguments
    ///
    /// * `flush_interval_secs` - Seconds between automatic flushes (default: 1)
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::process::TerminalLogger;
    ///
    /// let logger = TerminalLogger::new(1);
    /// ```
    pub fn new(flush_interval_secs: u64) -> Self {
        Self {
            buffer: Arc::new(RwLock::new(Vec::new())),
            flush_interval_secs,
        }
        .start_flush_task()
    }

    /// Starts the background flush task
    ///
    /// Spawns a periodic task that flushes the buffer to disk/log storage.
    /// Runs every `flush_interval_secs` seconds.
    fn start_flush_task(mut self) -> Self {
        let buffer = Arc::clone(&self.buffer);
        let interval_secs = self.flush_interval_secs;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));
            loop {
                interval.tick().await;
                // TODO: Flush buffer to persistent storage
                // This will be implemented when terminal logging is integrated
                let _buffer = buffer.read().await;
                // Placeholder: In production, write to file/database
            }
        });

        self
    }

    /// Appends a log line to the batch buffer
    ///
    /// Lines are buffered in memory and flushed periodically by the background task.
    ///
    /// # Arguments
    ///
    /// * `line` - Log line to append
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::process::TerminalLogger;
    ///
    /// # #[tokio::main]
    /// # async fn main() {
    /// let logger = TerminalLogger::new(1);
    /// logger.append("Hello, terminal!").await;
    /// # }
    /// ```
    pub async fn append(&self, line: &str) {
        let mut buffer = self.buffer.write().await;
        buffer.push(line.to_string());

        // Auto-flush if buffer grows too large (prevent unbounded memory growth)
        const MAX_BUFFER_SIZE: usize = 1000;
        if buffer.len() >= MAX_BUFFER_SIZE {
            // TODO: Immediate flush when buffer is full
            // This will be implemented when terminal logging is integrated
            buffer.clear();
        }
    }
}

impl ProcessManager {
    ///
    /// # Arguments
    ///
    /// * `terminal_id` - Terminal ID to check
    ///
    /// # Returns
    ///
    /// `true` if the process is tracked and has a valid ID, `false` otherwise.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::ProcessManager;
    ///
    /// # #[tokio::main]
    /// # async fn main() {
    /// let manager = ProcessManager::new();
    /// let is_running = manager.is_running("my-terminal").await;
    /// # }
    /// ```
    pub async fn is_running(&self, terminal_id: &str) -> bool {
        let processes = self.processes.read().await;
        processes
            .get(terminal_id)
            .is_some_and(|tracked| tracked.child.id().is_some())
    }

    /// Lists all currently tracked terminal IDs
    ///
    /// # Returns
    ///
    /// A vector of terminal IDs for all tracked processes.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::ProcessManager;
    ///
    /// # #[tokio::main]
    /// # async fn main() {
    /// let manager = ProcessManager::new();
    /// let terminals = manager.list_running().await;
    /// for terminal_id in terminals {
    ///     println!("Terminal: {}", terminal_id);
    /// }
    /// # }
    /// ```
    pub async fn list_running(&self) -> Vec<String> {
        let processes = self.processes.read().await;
        processes.keys().cloned().collect()
    }

    /// Removes dead processes from tracking
    ///
    /// Checks all tracked processes and removes those that have exited.
    /// This should be called periodically to clean up the process table.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::ProcessManager;
    ///
    /// # #[tokio::main]
    /// # async fn main() {
    /// let manager = ProcessManager::new();
    /// manager.cleanup().await;
    /// # }
    /// ```
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
        }
    }

    /// Get process handle by terminal ID
    ///
    /// Returns a ProcessHandle containing the I/O handles for the terminal process.
    /// This is a one-time operation - the handles are moved out of storage.
    ///
    /// # Arguments
    ///
    /// * `terminal_id` - Terminal ID to look up
    ///
    /// # Returns
    ///
    /// `Some(ProcessHandle)` if the terminal process exists and handles are available,
    /// `None` if the terminal doesn't exist or handles were already taken.
    ///
    /// # Examples
    ///
    /// ```no_run
    /// use services::services::terminal::ProcessManager;
    ///
    /// # #[tokio::main]
    /// # async fn main() {
    /// let manager = ProcessManager::new();
    /// let handle = manager.get_handle("my-terminal").await;
    /// # }
    /// ```
    pub async fn get_handle(&self, terminal_id: &str) -> Option<ProcessHandle> {
        let mut processes = self.processes.write().await;

        if let Some(tracked) = processes.get_mut(terminal_id) {
            // Check if process is still running
            let pid = tracked.child.id()?;

            // Check if handles are still available (not yet taken)
            if tracked.stdout.is_none() && tracked.stderr.is_none() && tracked.stdin.is_none() {
                // All handles have been taken
                return None;
            }

            let session_id = Uuid::new_v4().to_string();

            // Take I/O handles (one-time operation)
            let stdout = tracked.stdout.take();
            let stderr = tracked.stderr.take();
            let stdin = tracked.stdin.take();

            Some(ProcessHandle {
                pid,
                session_id,
                terminal_id: terminal_id.to_string(),
                stdout,
                stderr,
                stdin,
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

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    /// Helper function to create a long-running test process
    fn long_running_cmd() -> Command {
        #[cfg(unix)]
        {
            let mut cmd = Command::new("sleep");
            cmd.arg("10");
            cmd
        }
        #[cfg(windows)]
        {
            let mut cmd = Command::new("timeout");
            cmd.args(["/t", "10"]);
            cmd
        }
    }

    /// Helper function to create a quick-exit test process
    fn quick_exit_cmd() -> Command {
        #[cfg(unix)]
        {
            let mut cmd = Command::new("true");
            cmd
        }
        #[cfg(windows)]
        {
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", "exit 0"]);
            cmd
        }
    }

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
    async fn test_spawn_creates_process_handle() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        let result = manager
            .spawn("test-terminal", long_running_cmd(), temp_dir.path())
            .await;

        assert!(result.is_ok(), "Spawn should succeed");
        let handle = result.unwrap();
        assert_eq!(handle.terminal_id, "test-terminal");
        assert!(!handle.session_id.is_empty());
        assert_ne!(handle.pid, 0);
    }

    #[tokio::test]
    async fn test_spawn_tracks_process() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        let _ = manager
            .spawn("test-terminal", long_running_cmd(), temp_dir.path())
            .await;

        let running = manager.list_running().await;
        assert_eq!(running.len(), 1);
        assert!(running.contains(&"test-terminal".to_string()));
    }

    #[tokio::test]
    async fn test_is_running_detects_active_process() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        let _ = manager
            .spawn("test-terminal", long_running_cmd(), temp_dir.path())
            .await;

        assert!(manager.is_running("test-terminal").await);
        assert!(!manager.is_running("non-existent").await);
    }

    #[tokio::test]
    async fn test_cleanup_removes_dead_processes() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        let _ = manager
            .spawn("quick-exit", quick_exit_cmd(), temp_dir.path())
            .await;

        // Wait for process to exit
        tokio::time::sleep(Duration::from_millis(100)).await;

        // Before cleanup, process is still tracked
        let running_before = manager.list_running().await;
        assert_eq!(running_before.len(), 1);

        // Cleanup should remove dead processes
        manager.cleanup().await;

        let running_after = manager.list_running().await;
        assert_eq!(running_after.len(), 0);
    }

    #[tokio::test]
    async fn test_get_handle_returns_io_handles() {
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        let _ = manager
            .spawn("test-terminal", long_running_cmd(), temp_dir.path())
            .await;

        // First call should return handles
        let handle1 = manager.get_handle("test-terminal").await;
        assert!(handle1.is_some());
        let handle1 = handle1.unwrap();
        assert!(handle1.stdin.is_some());
        assert!(handle1.stdout.is_some());
        assert!(handle1.stderr.is_some());

        // Second call should return None (handles were taken)
        let handle2 = manager.get_handle("test-terminal").await;
        assert!(handle2.is_none());
    }

    #[tokio::test]
    async fn test_get_handle_for_nonexistent_terminal() {
        let manager = ProcessManager::new();

        let handle = manager.get_handle("non-existent").await;
        assert!(handle.is_none());
    }
}
