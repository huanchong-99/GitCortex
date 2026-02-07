use chrono::{DateTime, Utc};
use jsonwebtoken::{DecodingKey, Validation, decode};
use serde::Deserialize;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum TokenClaimsError {
    #[error("failed to decode JWT: {0}")]
    Decode(#[from] jsonwebtoken::errors::Error),
    #[error("missing `exp` claim in token")]
    MissingExpiration,
    #[error("invalid `exp` value `{0}`")]
    InvalidExpiration(i64),
    #[error("missing `sub` claim in token")]
    MissingSubject,
    #[error("invalid `sub` value: {0}")]
    InvalidSubject(String),
}

#[derive(Debug, Deserialize)]
struct ExpClaim {
    exp: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct SubClaim {
    sub: Option<String>,
}

/// Verify the signature and extract the expiration timestamp from a JWT.
///
/// # Arguments
/// * `token` - The JWT token string
/// * `secret` - The secret key used to verify the token signature
///
/// # Returns
/// The expiration timestamp as `DateTime<Utc>` if the token is valid
///
/// # Errors
/// Returns `TokenClaimsError` if:
/// - The token signature is invalid
/// - The token is malformed
/// - The expiration claim is missing
/// - The expiration value is invalid
pub fn verify_and_extract_expiration(
    token: &str,
    secret: &str,
) -> Result<DateTime<Utc>, TokenClaimsError> {
    let validation = Validation::default();
    let data = decode::<ExpClaim>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    let exp = data.claims.exp.ok_or(TokenClaimsError::MissingExpiration)?;
    DateTime::from_timestamp(exp, 0).ok_or(TokenClaimsError::InvalidExpiration(exp))
}

/// Verify the signature and extract the subject (user ID) from a JWT.
///
/// # Arguments
/// * `token` - The JWT token string
/// * `secret` - The secret key used to verify the token signature
///
/// # Returns
/// The subject UUID if the token is valid
///
/// # Errors
/// Returns `TokenClaimsError` if:
/// - The token signature is invalid
/// - The token is malformed
/// - The subject claim is missing
/// - The subject value is not a valid UUID
pub fn verify_and_extract_subject(token: &str, secret: &str) -> Result<Uuid, TokenClaimsError> {
    let validation = Validation::default();
    let data = decode::<SubClaim>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    let sub = data.claims.sub.ok_or(TokenClaimsError::MissingSubject)?;
    Uuid::parse_str(&sub).map_err(|_| TokenClaimsError::InvalidSubject(sub))
}

#[cfg(test)]
mod tests {
    use jsonwebtoken::{EncodingKey, Header, encode};
    use serde::Serialize;

    use super::*;

    /// Test claims structure for generating tokens
    #[derive(Debug, Serialize)]
    struct TestClaims {
        sub: Option<String>,
        exp: Option<i64>,
    }

    /// Helper function to create a test JWT token
    fn make_test_token(secret: &str, sub: Option<String>, exp: Option<i64>) -> String {
        let claims = TestClaims { sub, exp };
        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .expect("Failed to encode test token")
    }

    #[test]
    fn test_verify_rejects_invalid_signature() {
        // Create a token signed with one secret
        let exp = Utc::now().timestamp() + 3600;
        let token = make_test_token("secret-a", Some(Uuid::nil().to_string()), Some(exp));

        // Try to verify with a different secret - should fail
        let err = verify_and_extract_subject(&token, "secret-b").unwrap_err();
        assert!(matches!(err, TokenClaimsError::Decode(_)));
    }

    #[test]
    fn test_verify_extracts_subject_valid_token() {
        // Create a valid token with subject
        let exp = Utc::now().timestamp() + 3600;
        let subject = Uuid::nil();
        let token = make_test_token("secret", Some(subject.to_string()), Some(exp));

        // Verify and extract subject - should succeed
        let extracted = verify_and_extract_subject(&token, "secret").unwrap();
        assert_eq!(extracted, subject);
    }

    #[test]
    fn test_verify_missing_subject_returns_error() {
        // Create a token without subject claim
        let exp = Utc::now().timestamp() + 3600;
        let token = make_test_token("secret", None, Some(exp));

        // Try to extract subject - should fail with MissingSubject error
        let err = verify_and_extract_subject(&token, "secret").unwrap_err();
        assert!(matches!(err, TokenClaimsError::MissingSubject));
    }

    #[test]
    fn test_verify_invalid_subject_uuid_returns_error() {
        // Create a token with invalid UUID in subject
        let exp = Utc::now().timestamp() + 3600;
        let token = make_test_token("secret", Some("not-a-uuid".to_string()), Some(exp));

        // Try to extract subject - should fail with InvalidSubject error
        let err = verify_and_extract_subject(&token, "secret").unwrap_err();
        assert!(matches!(err, TokenClaimsError::InvalidSubject(_)));
    }

    #[test]
    fn test_verify_extracts_expiration_valid_token() {
        // Create a valid token with expiration
        let exp = Utc::now().timestamp() + 3600;
        let token = make_test_token("secret", Some(Uuid::nil().to_string()), Some(exp));

        // Verify and extract expiration - should succeed
        let extracted = verify_and_extract_expiration(&token, "secret").unwrap();
        assert_eq!(extracted.timestamp(), exp);
    }

    #[test]
    fn test_verify_missing_expiration_returns_error() {
        // Create a token without expiration claim
        // Note: Validation::default() requires exp, so this will fail with Decode error
        let token = make_test_token("secret", Some(Uuid::nil().to_string()), None);

        // Try to extract expiration - should fail with Decode error (validation requires exp)
        let err = verify_and_extract_expiration(&token, "secret").unwrap_err();
        assert!(matches!(err, TokenClaimsError::Decode(_)));
    }

    #[test]
    fn test_verify_expired_token_fails_validation() {
        // Create a token that's already expired
        let exp = Utc::now().timestamp() - 3600; // 1 hour ago
        let token = make_test_token("secret", Some(Uuid::nil().to_string()), Some(exp));

        // Try to verify - should fail because token is expired
        let err = verify_and_extract_subject(&token, "secret").unwrap_err();
        assert!(matches!(err, TokenClaimsError::Decode(_)));
    }
}
