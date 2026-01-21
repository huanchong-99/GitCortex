use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

const METADATA_SEPARATOR: &str = "---METADATA---";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    pub path: String,
    #[serde(rename = "changeType")]
    pub change_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub line: u32,
    pub severity: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitMetadata {
    pub workflow_id: String,
    pub task_id: String,
    pub terminal_id: String,
    pub status: String,
    pub reviewed_terminal: Option<String>,
    pub issues: Option<Vec<Issue>>,
    pub files_changed: Vec<FileChange>,
}

/// Parse commit message to extract metadata
///
/// Expected format:
/// ```text
/// Commit message title
///
/// Optional description
///
/// ---METADATA---
/// {"workflow_id":"wf-123",...}
/// ```
pub fn parse_commit_metadata(commit_message: &str) -> Result<CommitMetadata> {
    // Find separator
    let separator_pos = commit_message
        .find(METADATA_SEPARATOR)
        .ok_or_else(|| anyhow!("Commit metadata separator '{METADATA_SEPARATOR}' not found"))?;

    // Extract JSON after separator
    let json_str = commit_message[separator_pos + METADATA_SEPARATOR.len()..]
        .trim();

    // Parse JSON
    let metadata: CommitMetadata = serde_json::from_str(json_str)
        .map_err(|e| anyhow!("Failed to parse commit metadata JSON: {e}"))?;

    // Validate required fields
    if metadata.workflow_id.is_empty() {
        return Err(anyhow!("workflow_id cannot be empty"));
    }

    tracing::debug!(
        "Parsed commit metadata: workflow={}, task={}, terminal={}, status={}",
        metadata.workflow_id,
        metadata.task_id,
        metadata.terminal_id,
        metadata.status
    );

    Ok(metadata)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_commit_metadata_valid() {
        let commit_message = r#"
Implement user authentication

---METADATA---
{"workflowId":"wf-123","taskId":"task-456","terminalId":"term-789","status":"completed","reviewedTerminal":null,"issues":null,"filesChanged":[{"path":"src/auth.rs","changeType":"modified"}]}
"#;

        let metadata = parse_commit_metadata(commit_message).unwrap();

        assert_eq!(metadata.workflow_id, "wf-123");
        assert_eq!(metadata.task_id, "task-456");
        assert_eq!(metadata.terminal_id, "term-789");
        assert_eq!(metadata.status, "completed");
    }

    #[test]
    fn test_parse_commit_metadata_review_pass() {
        let commit_message = r#"
Review approved

---METADATA---
{"workflowId":"wf-123","taskId":"task-456","terminalId":"reviewer-term","status":"review_pass","reviewedTerminal":"term-789","issues":null,"filesChanged":[]}
"#;

        let metadata = parse_commit_metadata(commit_message).unwrap();

        assert_eq!(metadata.status, "review_pass");
        assert_eq!(metadata.reviewed_terminal, Some("term-789".to_string()));
    }

    #[test]
    fn test_parse_commit_metadata_review_reject() {
        let commit_message = r#"
Review rejected

---METADATA---
{"workflowId":"wf-123","taskId":"task-456","terminalId":"reviewer-term","status":"review_reject","reviewedTerminal":"term-789","issues":[{"line":42,"severity":"error","message":"Missing error handling"}],"filesChanged":[]}
"#;

        let metadata = parse_commit_metadata(commit_message).unwrap();

        assert_eq!(metadata.status, "review_reject");
        let issues = metadata.issues.unwrap();
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].line, 42);
    }

    #[test]
    fn test_parse_commit_metadata_no_metadata() {
        let commit_message = "Regular commit without metadata";

        let result = parse_commit_metadata(commit_message);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("METADATA"));
    }

    #[test]
    fn test_parse_commit_metadata_invalid_json() {
        let commit_message = r"
Commit with bad metadata

---METADATA---
{invalid json}
";

        let result = parse_commit_metadata(commit_message);
        assert!(result.is_err());
    }
}
