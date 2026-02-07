//! Unit tests for status broadcasting methods
//!
//! These tests verify the BusMessage variants and basic functionality
//! without requiring full integration test infrastructure.

use services::orchestrator::message_bus::BusMessage;

#[test]
fn test_bus_message_variants_exist() {
    // Verify that the new BusMessage variants exist

    // TerminalStatusUpdate variant
    let _msg = BusMessage::TerminalStatusUpdate {
        workflow_id: "test-workflow".to_string(),
        terminal_id: "test-terminal".to_string(),
        status: "running".to_string(),
    };

    // TaskStatusUpdate variant
    let _msg = BusMessage::TaskStatusUpdate {
        workflow_id: "test-workflow".to_string(),
        task_id: "test-task".to_string(),
        status: "running".to_string(),
    };

    // StatusUpdate variant (already existed)
    let _msg = BusMessage::StatusUpdate {
        workflow_id: "test-workflow".to_string(),
        status: "running".to_string(),
    };
}

#[test]
fn test_message_bus_creation() {
    // Verify MessageBus can be created
    use services::orchestrator::message_bus::MessageBus;

    let _bus = MessageBus::new(100);
    let _bus = MessageBus::default();
}

#[tokio::test]
async fn test_orchestrator_state_creation() {
    // Verify OrchestratorState can be created with a workflow_id
    use services::orchestrator::state::OrchestratorState;

    let state = OrchestratorState::new("test-workflow".to_string());
    assert_eq!(state.workflow_id, "test-workflow");
    assert_eq!(
        state.run_state,
        services::orchestrator::state::OrchestratorRunState::Idle
    );
}
