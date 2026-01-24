/// Tests for slug utility functions
use services::utils::slug::{slugify, generate_task_branch_name};

#[test]
fn test_slugify_basic() {
    assert_eq!(slugify("Login Feature"), "login-feature");
    assert_eq!(slugify("User Authentication"), "user-authentication");
}

#[test]
fn test_slugify_special_chars() {
    assert_eq!(slugify("Hello@World!"), "hello-world");
    assert_eq!(slugify("Test#1$Feature"), "test-1-feature");
}

#[test]
fn test_slugify_multiple_spaces() {
    assert_eq!(slugify("Multiple   Spaces"), "multiple-spaces");
}

#[test]
fn test_slugify_trim_hyphens() {
    assert_eq!(slugify("-Leading and Trailing-"), "leading-and-trailing");
}

#[test]
fn test_slugify_chinese_chars() {
    // Chinese characters should be removed (not alphanumeric)
    assert_eq!(slugify("用户登录 User Login"), "user-login");
}

#[test]
fn test_slugify_numbers() {
    assert_eq!(slugify("Task 123"), "task-123");
}

#[test]
fn test_slugify_empty_string() {
    assert_eq!(slugify(""), "");
}

#[test]
fn test_slugify_only_special_chars() {
    assert_eq!(slugify("@#$%"), "");
}

#[test]
fn test_generate_task_branch_name_no_conflicts() {
    let existing = vec![];
    let result = generate_task_branch_name("wf-123", "Login Feature", &existing);
    assert_eq!(result, "workflow/wf-123/login-feature");
}

#[test]
fn test_generate_task_branch_name_with_conflicts() {
    let existing = vec!["workflow/wf-123/login-feature".to_string()];
    let result = generate_task_branch_name("wf-123", "Login Feature", &existing);
    assert_eq!(result, "workflow/wf-123/login-feature-2");
}

#[test]
fn test_generate_task_branch_name_multiple_conflicts() {
    let existing = vec![
        "workflow/wf-123/login-feature".to_string(),
        "workflow/wf-123/login-feature-2".to_string(),
    ];
    let result = generate_task_branch_name("wf-123", "Login Feature", &existing);
    assert_eq!(result, "workflow/wf-123/login-feature-3");
}

#[test]
fn test_generate_task_branch_name_different_workflow() {
    let existing = vec!["workflow/wf-456/login-feature".to_string()];
    let result = generate_task_branch_name("wf-123", "Login Feature", &existing);
    assert_eq!(result, "workflow/wf-123/login-feature");
}

#[test]
fn test_generate_task_branch_name_different_task() {
    let existing = vec!["workflow/wf-123/user-authentication".to_string()];
    let result = generate_task_branch_name("wf-123", "Login Feature", &existing);
    assert_eq!(result, "workflow/wf-123/login-feature");
}
