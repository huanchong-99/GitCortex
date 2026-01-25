//! State Persistence Tests

use std::sync::Arc;

use tokio::sync::RwLock;

use crate::services::orchestrator::{
    persistence::{StatePersistence, PersistedState, PersistedTaskState},
    state::{OrchestratorState, TaskExecutionState, OrchestratorRunState},
    types::LLMMessage,
};

#[cfg(test)]
mod tests {
    use super::*;

    /// Test state serialization/deserialization
    #[test]
    fn test_state_serialization() {
        // Create a sample orchestrator state
        let mut state = OrchestratorState::new("test-workflow".to_string());

        // Add some task states
        let task_state = TaskExecutionState {
            task_id: "task-1".to_string(),
            current_terminal_index: 1,
            total_terminals: 3,
            completed_terminals: vec!["terminal-1".to_string()],
            failed_terminals: vec![],
            is_completed: false,
        };
        state.task_states.insert("task-1".to_string(), task_state);

        // Add conversation history
        state.conversation_history.push(LLMMessage {
            role: "system".to_string(),
            content: "You are a helpful assistant.".to_string(),
        });
        state.conversation_history.push(LLMMessage {
            role: "user".to_string(),
            content: "Complete the task.".to_string(),
        });

        state.total_tokens_used = 1000;
        state.error_count = 0;

        // Convert to persisted state
        let persisted: PersistedState = state.clone().into();

        // Verify conversion
        assert_eq!(persisted.workflow_id, "test-workflow");
        assert_eq!(persisted.task_states.len(), 1);
        assert_eq!(persisted.conversation_history.len(), 2);
        assert_eq!(persisted.total_tokens_used, 1000);
        assert_eq!(persisted.error_count, 0);

        // Serialize to JSON
        let json = serde_json::to_string(&persisted).unwrap();
        assert!(json.contains("test-workflow"));
        assert!(json.contains("task-1"));

        // Deserialize back
        let deserialized: PersistedState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.workflow_id, "test-workflow");
        assert_eq!(deserialized.task_states.len(), 1);
    }

    /// Test task state conversion
    #[test]
    fn test_task_state_conversion() {
        let task_state = TaskExecutionState {
            task_id: "task-1".to_string(),
            current_terminal_index: 2,
            total_terminals: 5,
            completed_terminals: vec!["term-1".to_string(), "term-2".to_string()],
            failed_terminals: vec!["term-3".to_string()],
            is_completed: false,
        };

        // Convert to persisted
        let persisted: PersistedTaskState = task_state.clone().into();
        assert_eq!(persisted.task_id, "task-1");
        assert_eq!(persisted.current_terminal_index, 2);
        assert_eq!(persisted.total_terminals, 5);
        assert_eq!(persisted.completed_terminals.len(), 2);
        assert_eq!(persisted.failed_terminals.len(), 1);
        assert!(!persisted.is_completed);

        // Convert back
        let restored: TaskExecutionState = persisted.into();
        assert_eq!(restored.task_id, "task-1");
        assert_eq!(restored.current_terminal_index, 2);
        assert_eq!(restored.total_terminals, 5);
        assert_eq!(restored.completed_terminals.len(), 2);
        assert_eq!(restored.failed_terminals.len(), 1);
        assert!(!restored.is_completed);
    }

    /// Test empty state serialization
    #[test]
    fn test_empty_state_serialization() {
        let state = OrchestratorState::new("empty-workflow".to_string());

        let persisted: PersistedState = state.into();
        let json = serde_json::to_string(&persisted).unwrap();

        // Should serialize even with empty state
        assert!(json.contains("empty-workflow"));

        let deserialized: PersistedState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.workflow_id, "empty-workflow");
        assert_eq!(deserialized.task_states.len(), 0);
        assert_eq!(deserialized.conversation_history.len(), 0);
    }

    /// Test conversation history persistence
    #[test]
    fn test_conversation_history_persistence() {
        let mut state = OrchestratorState::new("test-workflow".to_string());

        // Add multiple messages
        for i in 0..10 {
            state.conversation_history.push(LLMMessage {
                role: if i % 2 == 0 { "user" } else { "assistant" }.to_string(),
                content: format!("Message {}", i),
            });
        }

        let persisted: PersistedState = state.into();

        assert_eq!(persisted.conversation_history.len(), 10);
        assert_eq!(persisted.conversation_history[0].role, "user");
        assert_eq!(persisted.conversation_history[0].content, "Message 0");
    }

    /// Test error count persistence
    #[test]
    fn test_error_count_persistence() {
        let mut state = OrchestratorState::new("test-workflow".to_string());
        state.error_count = 5;

        let persisted: PersistedState = state.into();
        assert_eq!(persisted.error_count, 5);

        // Convert back and verify
        let json = serde_json::to_string(&persisted).unwrap();
        let deserialized: PersistedState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.error_count, 5);
    }
}
