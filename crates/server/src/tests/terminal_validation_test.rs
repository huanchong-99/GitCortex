//! Unit tests for terminal_id UUID validation
//!
//! These tests verify that the validate_terminal_id() function correctly
//! validates UUID v4 format before any database operations.

#[cfg(test)]
mod tests {
    use crate::routes::terminal_ws::validate_terminal_id;

    #[test]
    fn test_valid_uuid_v4() {
        // Test standard UUID v4 format
        let valid_id = "550e8400-e29b-41d4-a716-446655440000";
        assert!(validate_terminal_id(valid_id).is_ok());
    }

    #[test]
    fn test_valid_uuid_with_uppercase() {
        // Test UUID with uppercase letters (should be accepted)
        let valid_id = "550E8400-E29B-41D4-A716-446655440000";
        assert!(validate_terminal_id(valid_id).is_ok());
    }

    #[test]
    fn test_valid_uuid_mixed_case() {
        // Test UUID with mixed case letters (should be accepted)
        let valid_id = "550E8400-e29b-41d4-A716-446655440000";
        assert!(validate_terminal_id(valid_id).is_ok());
    }

    #[test]
    fn test_invalid_uuid_too_short() {
        // Test UUID that is too short
        let invalid_id = "550e8400";
        assert!(validate_terminal_id(invalid_id).is_err());
    }

    #[test]
    fn test_invalid_uuid_wrong_format() {
        // Test completely invalid format
        let invalid_id = "not-a-uuid";
        assert!(validate_terminal_id(invalid_id).is_err());
    }

    #[test]
    fn test_invalid_uuid_missing_hyphens() {
        // Test UUID without hyphens
        let invalid_id = "550e8400e29b41d4a716446655440000";
        assert!(validate_terminal_id(invalid_id).is_err());
    }

    #[test]
    fn test_empty_string() {
        // Test empty string
        assert!(validate_terminal_id("").is_err());
    }
}
