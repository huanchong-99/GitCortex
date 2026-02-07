//! Test ProcessManager exposure via Deployment trait
//!
//! This test verifies that the ProcessManager is properly accessible
//! through the Deployment trait, which is required for terminal_ws.rs
//! to manage terminal processes.

use deployment::Deployment;
use local_deployment::LocalDeployment;

#[tokio::test]
async fn test_deployment_exposes_process_manager() {
    // Create a LocalDeployment instance
    let deployment = LocalDeployment::new()
        .await
        .expect("Failed to create LocalDeployment");

    // Access the ProcessManager through the Deployment trait
    let process_manager = deployment.process_manager();

    // Verify we got a valid reference
    // The ProcessManager should be accessible and we should be able to call methods on it
    // We're just verifying the reference is valid here
    assert_eq!(
        std::sync::Arc::strong_count(process_manager),
        1,
        "ProcessManager should have exactly one strong reference from LocalDeployment"
    );
}

#[tokio::test]
async fn test_process_manager_clone_independence() {
    // Create a LocalDeployment instance
    let deployment = LocalDeployment::new()
        .await
        .expect("Failed to create LocalDeployment");

    // Get the ProcessManager reference
    let process_manager = deployment.process_manager();

    // Clone the deployment
    let deployment_clone = deployment.clone();

    // Both should provide access to the same ProcessManager
    let process_manager_clone = deployment_clone.process_manager();

    // They should be the same Arc pointer (same underlying instance)
    assert!(
        Arc::ptr_eq(process_manager, process_manager_clone),
        "Both deployment instances should reference the same ProcessManager"
    );
}
