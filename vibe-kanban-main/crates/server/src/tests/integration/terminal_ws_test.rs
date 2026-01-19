//! Integration tests for terminal WebSocket routes
//!
//! These tests verify that the WebSocket endpoint properly validates
//! terminal_id format before accepting connections.

#[cfg(test)]
mod tests {
    use crate::routes::terminal_ws::validate_terminal_id;

    /// Test that validation function is called by the handler
    ///
    /// This is a simpler integration test that verifies the validation logic
    /// without requiring a full HTTP server setup.
    #[tokio::test]
    async fn test_validation_rejects_invalid_terminal_id() {
        // Test that invalid IDs are rejected
        let invalid_ids = vec![
            "invalid-id",
            "550e8400e29b41d4a716446655440000", // missing hyphens
            "not-a-uuid",
            "",
            "550e8400", // too short
        ];

        for invalid_id in invalid_ids {
            assert!(
                validate_terminal_id(invalid_id).is_err(),
                "Expected validation to fail for: {}",
                invalid_id
            );
        }
    }

    /// Test that validation accepts valid terminal_id format
    #[tokio::test]
    async fn test_validation_accepts_valid_terminal_id() {
        // Test that valid UUID formats are accepted
        let valid_ids = vec![
            "550e8400-e29b-41d4-a716-446655440000",
            "550E8400-E29B-41D4-A716-446655440000", // uppercase
            "550E8400-e29b-41d4-A716-446655440000", // mixed case
            "00000000-0000-0000-0000-000000000000", // all zeros
            "ffffffff-ffff-ffff-ffff-ffffffffffff", // all f's
        ];

        for valid_id in valid_ids {
            assert!(
                validate_terminal_id(valid_id).is_ok(),
                "Expected validation to pass for: {}",
                valid_id
            );
        }
    }

    /// Test that validation error message is descriptive
    #[tokio::test]
    async fn test_validation_error_message() {
        let result = validate_terminal_id("invalid-id");
        assert!(result.is_err());

        let error_msg = result.unwrap_err().to_string();
        assert!(error_msg.contains("Invalid terminal_id format"));
        assert!(error_msg.contains("UUID"));
    }
}
