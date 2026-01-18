#!/bin/bash
# Test script to verify the security fix

cd "F:\Project\GitCortex\.worktrees\phase-8.5-code-quality-fix\vibe-kanban-main\crates\db"

echo "=== Test 1: Short key (5 bytes) - should FAIL ==="
export GITCORTEX_ENCRYPTION_KEY="short"
cargo test test_api_key_encryption_invalid_key_length -- --nocapture 2>&1 | grep -E "(test result|assertion failed)"

echo ""
echo "=== Test 2: Valid 32-byte key - should PASS ==="
export GITCORTEX_ENCRYPTION_KEY="12345678901234567890123456789012"
cargo test test_api_key_encryption_decryption -- --nocapture 2>&1 | grep -E "(test result|assertion failed)"

echo ""
echo "=== Test 3: Missing key - should FAIL ==="
unset GITCORTEX_ENCRYPTION_KEY
cargo test test_api_key_encryption_missing_env_key -- --nocapture 2>&1 | grep -E "(test result|assertion failed)"
