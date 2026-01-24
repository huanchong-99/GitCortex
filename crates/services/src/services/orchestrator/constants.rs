//! Constants for the Orchestrator module
//!
//! This module contains all hardcoded string constants used throughout the orchestrator.

/// Topic prefixes for message bus
pub const WORKFLOW_TOPIC_PREFIX: &str = "workflow:";
pub const TERMINAL_TOPIC_PREFIX: &str = "terminal:";
pub const GIT_EVENT_TOPIC_PREFIX: &str = "git_event:";

/// Commit metadata format
pub const GIT_COMMIT_METADATA_SEPARATOR: &str = "---METADATA---";

/// Environment variable names
pub const ENCRYPTION_KEY_ENV: &str = "GITCORTEX_ENCRYPTION_KEY";

/// Default configuration values
pub const DEFAULT_MAX_CONVERSATION_HISTORY: usize = 50;
pub const DEFAULT_LLM_TIMEOUT_SECS: u64 = 120;
pub const DEFAULT_MAX_RETRIES: u32 = 3;
pub const DEFAULT_RETRY_DELAY_MS: u64 = 1000;
pub const DEFAULT_LLM_RATE_LIMIT_PER_SECOND: u32 = 10;

/// Terminal status values
pub const TERMINAL_STATUS_PENDING: &str = "pending";
pub const TERMINAL_STATUS_RUNNING: &str = "running";
pub const TERMINAL_STATUS_COMPLETED: &str = "completed";
pub const TERMINAL_STATUS_FAILED: &str = "failed";
pub const TERMINAL_STATUS_REVIEW_PASSED: &str = "review_passed";
pub const TERMINAL_STATUS_REVIEW_REJECTED: &str = "review_rejected";

/// Workflow status values
pub const WORKFLOW_STATUS_PENDING: &str = "pending";
pub const WORKFLOW_STATUS_RUNNING: &str = "running";
pub const WORKFLOW_STATUS_COMPLETED: &str = "completed";
pub const WORKFLOW_STATUS_FAILED: &str = "failed";
pub const WORKFLOW_STATUS_MERGING: &str = "merging";
