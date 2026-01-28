use std::path::PathBuf;

#[test]
fn test_readme_audit_status() {
    let readme_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../README.md");
    let content = std::fs::read_to_string(&readme_path)
        .unwrap_or_else(|e| panic!("Failed to read README at {:?}: {}", readme_path, e));

    assert!(
        content.contains("68/100"),
        "README should report the current audit score (68/100)"
    );
    assert!(
        !content.contains("100/100") || content.contains("68/100"),
        "README should not claim a perfect 100/100 score without qualification"
    );
    assert!(
        content.contains("已知问题"),
        "README should include a known-issues section"
    );
}
