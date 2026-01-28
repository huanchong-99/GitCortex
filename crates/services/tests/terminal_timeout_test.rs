// Test for terminal timeout functionality
// This test ensures that terminal operations properly handle timeout scenarios

use services::services::terminal::process::ProcessManager;
use tokio::process::Command;
use std::time::Duration;

#[cfg(test)]
mod tests {
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
    async fn test_terminal_timeout_cleanup() {
        // Test that ProcessManager properly tracks and cleans up processes
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        // Spawn a quick-exit process
        let result = manager
            .spawn("test-terminal", quick_exit_cmd(), temp_dir.path())
            .await;

        assert!(result.is_ok(), "Spawn should succeed");

        // Verify process is tracked
        let running_before = manager.list_running().await;
        assert_eq!(running_before.len(), 1, "Process should be tracked");

        // Wait for process to exit
        tokio::time::sleep(Duration::from_millis(200)).await;

        // Cleanup should remove dead processes
        manager.cleanup().await;

        let running_after = manager.list_running().await;
        assert_eq!(running_after.len(), 0, "Dead process should be removed");
    }

    #[tokio::test]
    async fn test_terminal_is_running_detection() {
        // Test that is_running correctly detects active and dead processes
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        // Spawn long-running process
        let _ = manager
            .spawn("long-running", long_running_cmd(), temp_dir.path())
            .await;

        // Should be running
        assert!(manager.is_running("long-running").await, "Process should be running");
        assert!(!manager.is_running("non-existent").await, "Non-existent process should not be running");

        // Cleanup is not needed for long-running process
        // It will be killed when the test completes
    }

    #[tokio::test]
    async fn test_multiple_process_cleanup() {
        // Test cleanup of multiple processes
        let manager = ProcessManager::new();
        let temp_dir = tempfile::tempdir().unwrap();

        // Spawn multiple quick-exit processes
        for i in 0..3 {
            let result = manager
                .spawn(&format!("terminal-{}", i), quick_exit_cmd(), temp_dir.path())
                .await;
            assert!(result.is_ok(), "Spawn {} should succeed", i);
        }

        assert_eq!(manager.list_running().await.len(), 3, "All processes should be tracked");

        // Wait for processes to exit
        tokio::time::sleep(Duration::from_millis(200)).await;

        // Cleanup should remove all dead processes
        manager.cleanup().await;

        assert_eq!(manager.list_running().await.len(), 0, "All dead processes should be removed");
    }
}
