//! GitWatcher Service
//!
//! Monitors git repositories for commits containing workflow metadata
//! and publishes events to the message bus.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Result, Context};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::services::orchestrator::{BusMessage, MessageBus, TerminalCompletionEvent, TerminalCompletionStatus, CommitMetadata as OrchestratorCommitMetadata, CodeIssue};

// Convert our Issue to orchestrator's CodeIssue
impl From<Issue> for CodeIssue {
    fn from(issue: Issue) -> Self {
        CodeIssue {
            severity: issue.severity,
            file: issue.file,
            line: issue.line,
            message: issue.message,
            suggestion: issue.suggestion,
        }
    }
}

/// Configuration for GitWatcher
#[derive(Clone, Debug)]
pub struct GitWatcherConfig {
    /// Path to the git repository to watch
    pub repo_path: PathBuf,
    /// Polling interval in milliseconds
    pub poll_interval_ms: u64,
}

impl GitWatcherConfig {
    /// Create a new GitWatcherConfig
    pub fn new(repo_path: PathBuf, poll_interval_ms: u64) -> Self {
        Self {
            repo_path,
            poll_interval_ms,
        }
    }
}

/// Parsed metadata from a commit message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitMetadata {
    pub workflow_id: String,
    pub task_id: String,
    pub terminal_id: String,
    #[serde(default)]
    pub terminal_order: i32,
    #[serde(default)]
    pub cli: String,
    #[serde(default)]
    pub model: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reviewed_terminal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issues: Option<Vec<Issue>>,
    #[serde(default)]
    pub next_action: String,
}

/// Code issue reported in a commit
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Issue {
    pub severity: String,
    pub file: String,
    pub line: Option<i32>,
    pub message: String,
    pub suggestion: Option<String>,
}

impl CommitMetadata {
    /// Parse metadata from a commit message
    ///
    /// Expected format:
    /// ```text
    /// Commit message summary
    ///
    /// Optional body
    ///
    /// ---METADATA---
    /// workflow_id: xxx
    /// task_id: xxx
    /// terminal_id: xxx
    /// status: xxx
    /// ...
    /// ```
    pub fn parse(message: &str) -> Option<Self> {
        // Find the metadata section
        let metadata_start = message.find("---METADATA---")?;
        let metadata_section = &message[metadata_start + "---METADATA---".len()..];

        let mut metadata = CommitMetadata {
            workflow_id: String::new(),
            task_id: String::new(),
            terminal_id: String::new(),
            terminal_order: 0,
            cli: String::new(),
            model: String::new(),
            status: String::new(),
            severity: None,
            reviewed_terminal: None,
            issues: None,
            next_action: String::from("continue"),
        };

        // Parse each line in the metadata section
        for line in metadata_section.lines() {
            let line = line.trim();
            if let Some(pos) = line.find(':') {
                let key = &line[..pos].trim();
                let value = &line[pos + 1..].trim();

                match key {
                    "workflow_id" => metadata.workflow_id = value.to_string(),
                    "task_id" => metadata.task_id = value.to_string(),
                    "terminal_id" => metadata.terminal_id = value.to_string(),
                    "terminal_order" => {
                        metadata.terminal_order = value.parse().unwrap_or(0);
                    }
                    "cli" => metadata.cli = value.to_string(),
                    "model" => metadata.model = value.to_string(),
                    "status" => metadata.status = value.to_string(),
                    "severity" => metadata.severity = Some(value.to_string()),
                    "reviewed_terminal" => metadata.reviewed_terminal = Some(value.to_string()),
                    "issues" => {
                        metadata.issues = serde_json::from_str(value).ok();
                    }
                    "next_action" => metadata.next_action = value.to_string(),
                    _ => {}
                }
            }
        }

        // Validate required fields
        if metadata.workflow_id.is_empty()
            || metadata.task_id.is_empty()
            || metadata.terminal_id.is_empty()
            || metadata.status.is_empty()
        {
            return None;
        }

        Some(metadata)
    }

    /// Convert to orchestrator CommitMetadata
    pub fn to_orchestrator_metadata(&self) -> OrchestratorCommitMetadata {
        OrchestratorCommitMetadata {
            workflow_id: self.workflow_id.clone(),
            task_id: self.task_id.clone(),
            terminal_id: self.terminal_id.clone(),
            terminal_order: self.terminal_order,
            cli: self.cli.clone(),
            model: self.model.clone(),
            status: self.status.clone(),
            severity: self.severity.clone(),
            reviewed_terminal: self.reviewed_terminal.clone(),
            issues: self.issues.clone(),
            next_action: self.next_action.clone(),
        }
    }
}

/// Represents a single commit with its metadata
#[derive(Debug, Clone)]
pub struct ParsedCommit {
    pub hash: String,
    pub message: String,
    pub metadata: Option<CommitMetadata>,
}

/// Convenience function to parse commit metadata
/// This is a re-export of CommitMetadata::parse for easier use
pub fn parse_commit_metadata(message: &str) -> Option<CommitMetadata> {
    CommitMetadata::parse(message)
}

/// Re-export CodeIssue as Issue for compatibility
pub use crate::services::orchestrator::CodeIssue as Issue;

/// GitWatcher service for monitoring git repositories
pub struct GitWatcher {
    config: GitWatcherConfig,
    message_bus: MessageBus,
    last_commit_hash: Arc<Mutex<Option<String>>>,
    is_running: bool,
}

impl GitWatcher {
    /// Create a new GitWatcher with path validation
    pub fn new(config: GitWatcherConfig, message_bus: MessageBus) -> Result<Self> {
        let repo_path = &config.repo_path;

        // Validate path exists and is a directory
        if !repo_path.exists() {
            return Err(anyhow::anyhow!(
                "Repository path does not exist: {}",
                repo_path.display()
            ));
        }

        if !repo_path.is_dir() {
            return Err(anyhow::anyhow!(
                "Repository path is not a directory: {}",
                repo_path.display()
            ));
        }

        // Validate it's a git repository
        let git_dir = repo_path.join(".git");
        if !git_dir.exists() {
            return Err(anyhow::anyhow!(
                "Not a git repository (missing .git directory): {}",
                repo_path.display()
            ));
        }

        Ok(Self {
            config,
            message_bus,
            last_commit_hash: Arc::new(Mutex::new(None)),
            is_running: false,
        })
    }

    /// Check if the watcher is currently running
    pub fn is_running(&self) -> bool {
        self.is_running
    }

    /// Start watching the repository for new commits
    ///
    /// This method polls the git repository for new commits and processes
    /// any that contain workflow metadata. It runs until cancelled.
    pub async fn watch(&mut self) -> Result<()> {
        self.is_running = true;
        let repo_path = self.config.repo_path.clone();
        let poll_interval = Duration::from_millis(self.config.poll_interval_ms);

        tracing::info!(
            "Starting GitWatcher for {} (polling every {:?})",
            repo_path.display(),
            poll_interval
        );

        // Get initial HEAD commit
        if let Ok(initial_commit) = self.get_latest_commit(&repo_path).await {
            let mut last_hash = self.last_commit_hash.lock().await;
            *last_hash = Some(initial_commit.hash.clone());
            tracing::info!("Initial commit: {}", initial_commit.hash);
        }

        // Polling loop
        while self.is_running {
            tokio::time::sleep(poll_interval).await;

            // Check for new commits
            if let Ok(latest_commit) = self.get_latest_commit(&repo_path).await {
                // Check if this is a new commit - now with proper synchronization
                let new_hash = latest_commit.hash.clone();
                let should_process = {
                    let mut last_hash = self.last_commit_hash.lock().await;
                    let should = match last_hash.as_ref() {
                        Some(last) => *last != new_hash,
                        None => true,
                    };
                    if should {
                        *last_hash = Some(new_hash.clone());
                    }
                    should
                };

                if should_process {
                    tracing::info!("New commit detected: {}", new_hash);

                    // Process the new commit
                    if let Err(e) = self.handle_new_commit(latest_commit).await {
                        tracing::error!("Error handling new commit: {}", e);
                    }
                }
            }
        }

        tracing::info!("GitWatcher stopped");
        Ok(())
    }

    /// Stop watching the repository
    pub fn stop(&mut self) {
        self.is_running = false;
        tracing::info!("GitWatcher stop requested");
    }

    /// Get the latest commit from the repository
    async fn get_latest_commit(&self, repo_path: &Path) -> Result<ParsedCommit> {
        use tokio::process::Command;

        // Get commit hash and message
        let output = Command::new("git")
            .current_dir(repo_path)
            .args(["log", "-1", "--format=%H|%s"])
            .output()
            .await
            .context(format!(
                "Failed to get latest commit from {}",
                repo_path.display()
            ))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!(
                "git log failed for {}: {}",
                repo_path.display(),
                stderr
            );
        }

        let result = String::from_utf8_lossy(&output.stdout);
        let parts: Vec<&str> = result.trim().split('|').collect();

        if parts.len() < 2 {
            anyhow::bail!(
                "Invalid git log output format from {}",
                repo_path.display()
            );
        }

        let hash = parts[0].to_string();
        let message = parts[1..].join("|"); // Handle cases where message might contain '|'

        // Try to parse metadata from the commit message
        // Get full message body for metadata parsing
        let full_output = Command::new("git")
            .current_dir(repo_path)
            .args(["log", "-1", "--format=%B"])
            .output()
            .await
            .context(format!(
                "Failed to get commit body from {}",
                repo_path.display()
            ))?;

        if !full_output.status.success() {
            let stderr = String::from_utf8_lossy(&full_output.stderr);
            anyhow::bail!(
                "git log (body) failed for {}: {}",
                repo_path.display(),
                stderr
            );
        }

        let full_message = String::from_utf8_lossy(&full_output.stdout).to_string();
        let metadata = CommitMetadata::parse(&full_message);

        Ok(ParsedCommit {
            hash,
            message,
            metadata,
        })
    }

    /// Handle a new commit by parsing its metadata and publishing events
    async fn handle_new_commit(&self, commit: ParsedCommit) -> Result<()> {
        // Only process commits with metadata
        let metadata = match commit.metadata {
            Some(m) => m,
            None => {
                tracing::debug!(
                    "Commit {} has no workflow metadata, skipping",
                    commit.hash
                );
                return Ok(());
            }
        };

        tracing::info!(
            "Processing commit with workflow_id={}, task_id={}, terminal_id={}, status={}",
            metadata.workflow_id,
            metadata.task_id,
            metadata.terminal_id,
            metadata.status
        );

        // Determine completion status
        let completion_status = match metadata.status.as_str() {
            "completed" => TerminalCompletionStatus::Completed,
            "review_pass" => TerminalCompletionStatus::ReviewPass,
            "review_reject" => TerminalCompletionStatus::ReviewReject,
            "failed" => TerminalCompletionStatus::Failed,
            _ => {
                tracing::warn!("Unknown status '{}', defaulting to Completed", metadata.status);
                TerminalCompletionStatus::Completed
            }
        };

        // Create terminal completion event
        let event = TerminalCompletionEvent {
            terminal_id: metadata.terminal_id.clone(),
            task_id: metadata.task_id.clone(),
            workflow_id: metadata.workflow_id.clone(),
            status: completion_status,
            commit_hash: Some(commit.hash.clone()),
            commit_message: Some(commit.message.clone()),
            metadata: Some(metadata.to_orchestrator_metadata()),
        };

        // Publish to message bus with proper error handling
        self.message_bus
            .publish_terminal_completed(event)
            .await
            .context(format!(
                "Failed to publish terminal completion event for workflow {}",
                metadata.workflow_id
            ))?;

        tracing::info!(
            "Published TerminalCompleted event for terminal {}",
            metadata.terminal_id
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_commit_metadata_basic() {
        let message = r#"Complete feature implementation

---METADATA---
workflow_id: abc-123
task_id: task-456
terminal_id: terminal-789
status: completed"#;

        let metadata = CommitMetadata::parse(message).expect("Should parse metadata");

        assert_eq!(metadata.workflow_id, "abc-123");
        assert_eq!(metadata.task_id, "task-456");
        assert_eq!(metadata.terminal_id, "terminal-789");
        assert_eq!(metadata.status, "completed");
    }

    #[test]
    fn test_parse_commit_metadata_full() {
        let message = r#"feat(14.5): create GitWatcher service

Implementation details here.

---METADATA---
workflow_id: wf-123
task_id: task-456
terminal_id: terminal-789
terminal_order: 0
cli: claude-code
model: sonnet-4.5
status: completed
severity: info
reviewed_terminal: terminal-001
next_action: continue"#;

        let metadata = CommitMetadata::parse(message).expect("Should parse metadata");

        assert_eq!(metadata.workflow_id, "wf-123");
        assert_eq!(metadata.terminal_order, 0);
        assert_eq!(metadata.cli, "claude-code");
        assert_eq!(metadata.model, "sonnet-4.5");
        assert_eq!(metadata.severity, Some("info".to_string()));
        assert_eq!(metadata.reviewed_terminal, Some("terminal-001".to_string()));
        assert_eq!(metadata.next_action, "continue");
    }

    #[test]
    fn test_parse_commit_metadata_with_issues() {
        let message = r#"Fix bug

---METADATA---
workflow_id: wf-123
task_id: task-456
terminal_id: terminal-789
status: failed
issues: [{"severity":"error","file":"src/lib.rs","line":42,"message":"Null pointer","suggestion":"Add check"}]
next_action: retry"#;

        let metadata = CommitMetadata::parse(message).expect("Should parse metadata");

        assert_eq!(metadata.status, "failed");
        assert_eq!(metadata.next_action, "retry");

        let issues = metadata.issues.expect("Should have issues");
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].severity, "error");
        assert_eq!(issues[0].file, "src/lib.rs");
        assert_eq!(issues[0].line, Some(42));
    }

    #[test]
    fn test_parse_commit_metadata_missing_required_fields() {
        let message = r#"Incomplete commit

---METADATA---
workflow_id: wf-123
task_id: task-456
# missing terminal_id and status"#;

        let metadata = CommitMetadata::parse(message);
        assert!(metadata.is_none(), "Should return None when required fields are missing");
    }

    #[test]
    fn test_parse_commit_metadata_no_metadata_section() {
        let message = "Normal commit without any metadata section";

        let metadata = CommitMetadata::parse(message);
        assert!(metadata.is_none(), "Should return None for commits without metadata");
    }
}
