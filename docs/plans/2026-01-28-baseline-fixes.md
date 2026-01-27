# 编译错误修复 - 基线清理实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 修复9个编译错误，建立干净的测试基线，所有测试通过，零编译错误

**架构:** 按错误类别逐个修复，每个修复独立测试验证，确保不引入新问题

**技术栈:** Rust, Cargo Test, SQLx, Git worktree

---

## Task 1: 添加缺失的 WORKFLOW_STATUS_READY 常量

**错误:** `unresolved import "super::constants::WORKFLOW_STATUS_READY"`

**原因:** `constants.rs` 中缺少 `WORKFLOW_STATUS_READY` 常量定义

**Files:**
- Modify: `crates/services/src/services/orchestrator/constants.rs`

**Step 1: 编写失败测试（验证常量存在）**

创建临时测试文件 `crates/services/src/services/orchestrator/constants_test.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::super::constants::*;

    #[test]
    fn test_all_workflow_status_constants_exist() {
        // 验证所有需要的 workflow status 常量都存在
        let _ = WORKFLOW_STATUS_PENDING;
        let _ = WORKFLOW_STATUS_READY;      // 这是缺失的
        let _ = WORKFLOW_STATUS_RUNNING;
        let _ = WORKFLOW_STATUS_COMPLETED;
        let _ = WORKFLOW_STATUS_FAILED;
        let _ = WORKFLOW_STATUS_MERGING;
    }

    #[test]
    fn test_workflow_status_ready_value() {
        assert_eq!(WORKFLOW_STATUS_READY, "ready");
    }
}
```

在 `constants.rs` 底部添加:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_all_workflow_status_constants_exist() {
        let _ = WORKFLOW_STATUS_PENDING;
        let _ = WORKFLOW_STATUS_READY;
        let _ = WORKFLOW_STATUS_RUNNING;
        let _ = WORKFLOW_STATUS_COMPLETED;
        let _ = WORKFLOW_STATUS_FAILED;
        let _ = WORKFLOW_STATUS_MERGING;
    }

    #[test]
    fn test_workflow_status_ready_value() {
        assert_eq!(WORKFLOW_STATUS_READY, "ready");
    }
}
```

**Step 2: 运行测试验证失败**

```bash
cd .worktrees/phase-18
cargo test --package services orchestrator::constants::tests::test_workflow_status_ready_value
```

预期输出: `ERROR: cannot find value "WORKFLOW_STATUS_READY" in this scope`

**Step 3: 实现最小修复**

在 `crates/services/src/services/orchestrator/constants.rs` 的 workflow status 部分添加:

```rust
/// Workflow status values
pub const WORKFLOW_STATUS_PENDING: &str = "pending";
pub const WORKFLOW_STATUS_READY: &str = "ready";      // 新增
pub const WORKFLOW_STATUS_RUNNING: &str = "running";
pub const WORKFLOW_STATUS_COMPLETED: &str = "completed";
pub const WORKFLOW_STATUS_FAILED: &str = "failed";
pub const WORKFLOW_STATUS_MERGING: &str = "merging";
```

**Step 4: 运行测试验证通过**

```bash
cargo test --package services orchestrator::constants::tests
```

预期输出: `PASS: test_workflow_status_ready_value`, `PASS: test_all_workflow_status_constants_exist`

**Step 5: 提交**

```bash
cd .worktrees/phase-18
git add crates/services/src/services/orchestrator/constants.rs
git commit -m "fix: add missing WORKFLOW_STATUS_READY constant

- Add WORKFLOW_STATUS_READY = \"ready\" to constants.rs
- Resolves compilation error in runtime.rs:15

Refs: #baseline-fix"
```

---

## Task 2: 修复 cc_switch.rs 中的 trait 实现可见性错误

**错误:** `visibility qualifiers are not permitted here` (lines 90, 98)

**原因:** `switch_for_terminals` 和 `detect_cli` 方法在 trait impl 块中有 `pub` 修饰符

**Files:**
- Modify: `crates/services/src/services/cc_switch.rs`

**Step 1: 编写失败测试（验证方法可调用）**

创建测试文件 `crates/services/src/services/cc_switch_test.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use db::{DBService, models::CliType};
    use std::sync::Arc;

    #[tokio::test]
    async fn test_switch_for_terminals_method_exists() {
        // 这个测试验证 switch_for_terminals 方法可以正常调用
        // 它应该不在 trait 中，而是 CCSwitchService 的固有方法
        let db = Arc::new(DBService::new().await.unwrap());
        let service = CCSwitchService::new(db);

        // 验证方法存在（编译时检查）
        let terminals: Vec<db::models::Terminal> = vec![];
        let _ = service.switch_for_terminals(&terminals).await;
    }

    #[tokio::test]
    async fn test_detect_cli_method_exists() {
        let db = Arc::new(DBService::new().await.unwrap());
        let service = CCSwitchService::new(db);

        // 验证方法存在（编译时检查）
        let _ = service.detect_cli("cursor").await;
    }
}
```

**Step 2: 运行测试验证失败**

```bash
cargo test --package services cc_switch::tests::test_switch_for_terminals_method_exists
```

预期输出: `ERROR: visibility qualifiers are not permitted here`

**Step 3: 实现最小修复**

将 `crates/services/src/services/cc_switch.rs` 中 trait impl 块内的方法移到独立 impl 块:

**原代码结构（有问题）：**
```rust
#[async_trait]
impl CCSwitch for CCSwitchService {
    async fn switch_for_terminal(&self, terminal: &Terminal) -> anyhow::Result<()> {
        // ... 实现
    }

    // ❌ 错误：trait impl 中不能有 pub
    pub async fn switch_for_terminals(&self, terminals: &[Terminal]) -> anyhow::Result<()> {
        // ...
    }

    // ❌ 错误：trait impl 中不能有 pub
    pub async fn detect_cli(&self, cli_name: &str) -> anyhow::Result<bool> {
        // ...
    }
}
```

**修复后的代码结构：**
```rust
#[async_trait]
impl CCSwitch for CCSwitchService {
    async fn switch_for_terminal(&self, terminal: &Terminal) -> anyhow::Result<()> {
        // ... 保持原有实现
    }
}

// 新的固有方法 impl 块
impl CCSwitchService {
    /// 批量切换模型（用于工作流启动）
    ///
    /// 按顺序为所有终端切换模型配置。
    pub async fn switch_for_terminals(&self, terminals: &[Terminal]) -> anyhow::Result<()> {
        for terminal in terminals {
            self.switch_for_terminal(terminal).await?;
        }
        Ok(())
    }

    /// 检测 CLI 安装状态
    pub async fn detect_cli(&self, cli_name: &str) -> anyhow::Result<bool> {
        use tokio::process::Command;

        let cli_type = CliType::find_by_name(&self.db.pool, cli_name).await?;

        if let Some(cli) = cli_type {
            let parts: Vec<&str> = cli.detect_command.split_whitespace().collect();
            if parts.is_empty() {
                return Ok(false);
            }

            let result = Command::new(parts[0]).args(&parts[1..]).output().await;

            Ok(result.map(|o| o.status.success()).unwrap_or(false))
        } else {
            Ok(false)
        }
    }
}
```

完整修改步骤：
1. 找到 `impl CCSwitch for CCSwitchService` 块的结束位置（在 line 85 的 `Ok(())` 之后）
2. 在 `}` 之前删除 lines 87-115 的两个方法
3. 在 line 117 之前（impl 块外）添加新的 `impl CCSwitchService` 块

**Step 4: 运行测试验证通过**

```bash
cargo test --package services cc_switch
```

预期输出: 所有测试通过，无编译错误

**Step 5: 提交**

```bash
git add crates/services/src/services/cc_switch.rs
git commit -m "fix: move non-trait methods out of trait impl block

- Move switch_for_terminals and detect_cli to separate impl block
- Remove invalid 'pub' visibility from trait implementation
- These methods are now inherent methods of CCSwitchService

Fixes compilation errors at cc_switch.rs:90 and cc_switch.rs:98

Refs: #baseline-fix"
```

---

## Task 3: 修复 terminal_coordinator.rs 导入路径错误

**错误:** `use of unresolved module or unlinked crate 'services'`

**原因:** 导入路径重复了 `services` 模块名

**Files:**
- Modify: `crates/services/src/services/orchestrator/terminal_coordinator.rs`

**Step 1: 编写失败测试（验证导入正确）**

```bash
cd .worktrees/phase-18
cargo check --package services 2>&1 | grep "terminal_coordinator"
```

预期输出: `error: use of unresolved module or unlinked crate 'services'`

**Step 2: 实现最小修复**

修改 line 10:

**原代码：**
```rust
use services::services::cc_switch::CCSwitch;
```

**修复后：**
```rust
use crate::services::cc_switch::CCSwitch;
```

**Step 3: 验证修复**

```bash
cargo check --package services 2>&1 | grep -A 2 "terminal_coordinator"
```

预期输出: 无错误（或输出其他无关错误）

**Step 4: 提交**

```bash
git add crates/services/src/services/orchestrator/terminal_coordinator.rs
git commit -m "fix: correct import path in terminal_coordinator

- Change 'use services::services::cc_switch::CCSwitch'
- To 'use crate::services::cc_switch::CCSwitch'
- Fixes duplicate module name in import path

Refs: #baseline-fix"
```

---

## Task 4: 实现 parse_commit_metadata 函数

**错误:** `cannot find function 'parse_commit_metadata' in module 'crate::services::git_watcher'`

**原因:** `agent.rs:191` 调用了不存在的函数

**Files:**
- Modify: `crates/services/src/services/git_watcher.rs`
- Test: `crates/services/src/services/git_watcher_test.rs`

**Step 1: 查看调用上下文**

查看 `agent.rs:191` 附近代码了解函数签名需求:

```rust
let metadata = crate::services::git_watcher::parse_commit_metadata(message)?;
```

需要的函数签名应该是：
```rust
pub fn parse_commit_metadata(message: &str) -> anyhow::Result<CommitMetadata>
```

**Step 2: 编写失败测试**

在 `crates/services/src/services/git_watcher_test.rs` 添加:

```rust
#[test]
fn test_parse_commit_metadata_valid() {
    let message = "Added new feature\n---METADATA---\n{\"issue\": \"123\", \"type\": \"feature\"}";
    let result = parse_commit_metadata(message);
    assert!(result.is_ok());
}

#[test]
fn test_parse_commit_metadata_no_metadata() {
    let message = "Simple commit message without metadata";
    let result = parse_commit_metadata(message);
    assert!(result.is_ok()); // 应该返回空 metadata 而不是错误
}

#[test]
fn test_parse_commit_metadata_invalid_json() {
    let message = "Some message\n---METADATA---\n{invalid json}";
    let result = parse_commit_metadata(message);
    assert!(result.is_err());
}
```

**Step 3: 运行测试验证失败**

```bash
cargo test --package services git_watcher::tests::test_parse_commit_metadata
```

预期输出: `ERROR: cannot find function 'parse_commit_metadata'`

**Step 4: 实现最小修复**

在 `crates/services/src/services/git_watcher.rs` 添加:

```rust
use anyhow::{anyhow, Result};
use serde::Deserialize;
use super::constants::GIT_COMMIT_METADATA_SEPARATOR;

/// Parsed commit metadata
#[derive(Debug, Clone, Deserialize)]
pub struct CommitMetadata {
    /// Issue ID if present
    #[serde(default)]
    pub issue: Option<String>,

    /// Commit type if present
    #[serde(default)]
    pub commit_type: Option<String>,

    /// Additional metadata fields
    #[serde(flatten)]
    pub extra: std::collections::HashMap<String, serde_json::Value>,
}

/// Parse commit metadata from commit message
///
/// Format: "commit message\n---METADATA---\n{json}"
///
/// Returns empty metadata if separator not found.
pub fn parse_commit_metadata(message: &str) -> Result<CommitMetadata> {
    if let Some(separator_pos) = message.find(GIT_COMMIT_METADATA_SEPARATOR) {
        let json_str = message[separator_pos + GIT_COMMIT_METADATA_SEPARATOR.len()..].trim();
        serde_json::from_str(json_str)
            .map_err(|e| anyhow!("Failed to parse commit metadata JSON: {}", e))
    } else {
        // No metadata, return empty
        Ok(CommitMetadata {
            issue: None,
            commit_type: None,
            extra: std::collections::HashMap::new(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_commit_metadata_valid() {
        let message = "Added new feature\n---METADATA---\n{\"issue\": \"123\", \"type\": \"feature\"}";
        let result = parse_commit_metadata(message);
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.issue, Some("123".to_string()));
    }

    #[test]
    fn test_parse_commit_metadata_no_metadata() {
        let message = "Simple commit message without metadata";
        let result = parse_commit_metadata(message);
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert!(metadata.issue.is_none());
    }

    #[test]
    fn test_parse_commit_metadata_invalid_json() {
        let message = "Some message\n---METADATA---\n{invalid json}";
        let result = parse_commit_metadata(message);
        assert!(result.is_err());
    }
}
```

**Step 5: 运行测试验证通过**

```bash
cargo test --package services git_watcher::tests
```

预期输出: 所有 3 个测试通过

**Step 6: 提交**

```bash
git add crates/services/src/services/git_watcher.rs
git commit -m "feat: add parse_commit_metadata function

- Parse JSON metadata from commit messages
- Format: 'message\n---METADATA---\n{json}'
- Returns empty metadata if separator not found
- Includes comprehensive unit tests

Fixes compilation error at agent.rs:191

Refs: #baseline-fix"
```

---

## Task 5: 实现 Issue 类型

**错误:** `cannot find type 'Issue' in module 'crate::services::git_watcher'`

**原因:** `agent.rs:326` 使用了不存在的类型

**Files:**
- Modify: `crates/services/src/services/git_watcher.rs`
- Modify: `crates/services/src/services/orchestrator/agent.rs` (更新使用)

**Step 1: 查看调用上下文**

查看 `agent.rs:326` 附近代码:

```rust
issues: &[crate::services::git_watcher::Issue],
```

需要定义 `Issue` 类型，可能用于表示 GitHub/GitLab issue。

**Step 2: 编写失败测试**

在 `git_watcher_test.rs` 添加:

```rust
#[test]
fn test_issue_type_exists() {
    let issue = Issue {
        id: "123".to_string(),
        title: "Test Issue".to_string(),
        status: IssueStatus::Open,
    };
    assert_eq!(issue.id, "123");
}
```

**Step 3: 运行测试验证失败**

```bash
cargo test --package services git_watcher::tests::test_issue_type_exists
```

预期输出: `ERROR: cannot find type 'Issue' in this scope`

**Step 4: 实现最小修复**

在 `crates/services/src/services/git_watcher.rs` 添加:

```rust
/// Issue status
#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum IssueStatus {
    Open,
    Closed,
    InProgress,
}

/// Issue representation
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Issue {
    /// Issue ID or number
    pub id: String,

    /// Issue title
    pub title: String,

    /// Issue status
    pub status: IssueStatus,

    /// Issue description (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Issue labels (optional)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub labels: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_issue_type_exists() {
        let issue = Issue {
            id: "123".to_string(),
            title: "Test Issue".to_string(),
            status: IssueStatus::Open,
            description: None,
            labels: vec![],
        };
        assert_eq!(issue.id, "123");
        assert_eq!(issue.status, IssueStatus::Open);
    }

    #[test]
    fn test_issue_serialization() {
        let issue = Issue {
            id: "456".to_string(),
            title: "Feature request".to_string(),
            status: IssueStatus::InProgress,
            description: Some("Add new feature".to_string()),
            labels: vec!["enhancement".to_string()],
        };

        let json = serde_json::to_string(&issue).unwrap();
        assert!(json.contains("\"id\":\"456\""));
        assert!(json.contains("\"status\":\"in_progress\""));
    }
}
```

**Step 5: 验证 agent.rs 中的使用**

检查 `agent.rs:326` 的函数签名，确保参数类型匹配。可能需要调整:

```rust
// 如果函数签名是：
pub async fn some_function(&self, issues: &[Issue]) -> Result<()> {
    // ...
}
```

**Step 6: 运行测试验证通过**

```bash
cargo test --package services git_watcher::tests::test_issue
```

预期输出: Issue 相关测试通过

**Step 7: 提交**

```bash
git add crates/services/src/services/git_watcher.rs
git commit -m "feat: add Issue type for git integration

- Add Issue struct with id, title, status, description, labels
- Add IssueStatus enum (Open, Closed, InProgress)
- Support JSON serialization/deserialization
- Include unit tests for type validation

Fixes compilation error at agent.rs:326

Refs: #baseline-fix"
```

---

## Task 6: 修复 SQLx query! 宏错误

**错误:** `set DATABASE_URL to use query macros online, or run 'cargo sqlx prepare'`

**原因:** `runtime.rs:265` 使用了 `sqlx::query!` 编译时检查宏，但 worktree 中缺少 SQLx 缓存

**Files:**
- Modify: `crates/services/src/services/orchestrator/runtime.rs`

**Step 1: 验证 .sqlx 缓存是否存在**

```bash
cd .worktrees/phase-18
ls -la crates/db/.sqlx/ | head -10
```

预期输出: `.sqlx` 目录存在且有缓存文件

**Step 2: 编写失败测试**

```bash
cargo check --package services orchestrator::runtime 2>&1 | grep -A 3 "query!"
```

预期输出: SQLx query! 宏错误

**Step 3: 实现最小修复（两种方案）**

**方案 A: 使用 sqlx::query_unchecked!（快速但不安全）**

```rust
// 将 line 265 的 query! 改为 query_unchecked!
let rows = sqlx::query_unchecked!(  // ❌ 不推荐：失去编译时检查
    r#"
    SELECT id
    FROM workflow
    WHERE status = 'running'
    "#
)
.fetch_all(pool)
.await?;
```

**方案 B: 使用 sqlx::query（推荐）**

```rust
// 将 line 265 的 query! 改为 query
let rows = sqlx::query(  // ✅ 推荐：保持运行时检查
    r#"
    SELECT id
    FROM workflow
    WHERE status = 'running'
    "#
)
.fetch_all(pool)
.await?;

// 手动解析结果
let workflow_ids: Vec<String> = rows
    .into_iter()
    .map(|row| row.get("id"))
    .collect();
```

**推荐使用方案 B**，因为它：
1. 保持代码安全性
2. 不依赖 SQLx 离线模式
3. 与代码库其他部分一致

修改 `runtime.rs:265-273`:

```rust
// Direct SQL query to find running workflows
use sqlx::Row;

let rows = sqlx::query(
    r#"
    SELECT id
    FROM workflow
    WHERE status = 'running'
    "#
)
.fetch_all(pool)
.await?;

if rows.is_empty() {
    info!("No running workflows to recover");
    return Ok(());
}

warn!("Found {} running workflows to recover", rows.len());

for row in rows {
    let workflow_id: String = row.get("id");  // 注意：从 &str 改为 String
    warn!("Recovering workflow {}", workflow_id);
```

**Step 4: 验证修复**

```bash
cargo check --package services orchestrator::runtime
```

预期输出: 编译通过（或只输出其他无关错误）

**Step 5: 提交**

```bash
git add crates/services/src/services/orchestrator/runtime.rs
git commit -m "fix: replace sqlx::query! with sqlx::query

- Change query! macro to query for workflow recovery
- Remove dependency on SQLx offline mode in worktree
- Maintain runtime type safety with manual row parsing
- Update workflow_id type from &str to String for consistency

Fixes SQLx macro compilation error at runtime.rs:265

Refs: #baseline-fix"
```

---

## Task 7: 验证所有错误修复

**目标:** 确保所有9个编译错误已修复，测试通过

**Step 1: 完整编译检查**

```bash
cd .worktrees/phase-18
cargo check --workspace 2>&1 | tee /tmp/cargo-check.log
```

预期输出: `Finished 'dev' profile` 或仅有警告

**Step 2: 检查剩余错误**

```bash
grep "^error" /tmp/cargo-check.log | wc -l
```

预期输出: `0`（零错误）

**Step 3: 运行完整测试套件**

```bash
cargo test --workspace 2>&1 | tee /tmp/cargo-test.log
```

预期输出: 所有测试通过，统计结果显示 `X passed, 0 failed`

**Step 4: 验证测试覆盖率**

```bash
grep "test result" /tmp/cargo-test.log | tail -5
```

预期输出: 显示各包的测试结果，无失败

**Step 5: 提交验证脚本**

创建 `scripts/verify-baseline.sh`:

```bash
#!/bin/bash
set -e

echo "=== Verifying clean baseline ==="

echo "1. Running cargo check..."
cargo check --workspace

echo "2. Running cargo test..."
cargo test --workspace

echo "3. Checking for compilation errors..."
ERRORS=$(cargo check --workspace 2>&1 | grep "^error" | wc -l)
if [ "$ERRORS" -ne 0 ]; then
    echo "❌ Found $ERRORS compilation errors"
    exit 1
fi

echo "✅ Clean baseline verified!"
echo "   - Zero compilation errors"
echo "   - All tests passing"
```

```bash
git add scripts/verify-baseline.sh
git commit -m "chore: add baseline verification script

- Automated script to verify clean compilation
- Checks for zero errors
- Runs full test suite
- Exit with error if baseline degraded

Refs: #baseline-fix"
```

---

## Task 8: 清理警告（可选但推荐）

**目标:** 消除所有编译警告，达到零警告交付

**当前警告列表:**
1. `unused_import: uuid::Uuid` in `persistence.rs:12`
2. `unnecessary_parentheses` in `persistence.rs:158`
3. `unused_import: TerminalCoordinator` in `terminal_coordinator_test.rs:11`
4. `unused_import: Workflow, WorkflowTask` in `terminal_coordinator_test.rs:16`

**Step 1: 修复 persistence.rs:12 未使用导入**

```bash
cargo check --package services 2>&1 | grep "unused_import.*Uuid"
```

修改 `crates/services/src/services/orchestrator/persistence.rs`:

```rust
// 删除 line 12
- use uuid::Uuid;
```

**Step 2: 修复 persistence.rs:158 不必要的括号**

修改 line 158:

```rust
// 原代码
let row = sqlx::query_as::<_, (Option<String>)>(query)

// 修复后
let row = sqlx::query_as::<_, Option<String>>(query)
```

**Step 3: 修复 terminal_coordinator_test.rs 未使用导入**

修改测试文件，删除未使用的导入或添加 `#[allow(unused_imports)]`:

```rust
- use crate::services::orchestrator::terminal_coordinator::TerminalCoordinator;
- use crate::services::orchestrator::workflow::{Workflow, WorkflowTask};

// 如果测试需要这些类型但还未使用，添加 TODO
// TODO: add tests using TerminalCoordinator, Workflow, WorkflowTask
```

或在文件顶部添加:
```rust
#![allow(unused_imports)]
```

**Step 4: 验证零警告**

```bash
cargo check --workspace 2>&1 | grep "warning:" | wc -l
```

预期输出: `0`（或仅允许的警告）

**Step 5: 提交**

```bash
git add crates/services/src/services/orchestrator/persistence.rs
git add crates/services/src/services/orchestrator/terminal_coordinator_test.rs
git commit -m "chore: cleanup compilation warnings

- Remove unused uuid::Uuid import
- Remove unnecessary parentheses in query_as
- Remove unused imports in terminal_coordinator_test

Achieves zero-warning compilation baseline.

Refs: #baseline-fix"
```

---

## Task 9: 建立回归防护

**目标:** 确保未来不会重新引入这些编译错误

**Step 1: 创建 CI 检查脚本**

创建 `.github/workflows/baseline-check.yml`:

```yaml
name: Baseline Check

on:
  push:
    branches: [main, phase-18]
  pull_request:
    branches: [main, phase-18]

jobs:
  verify-compilation:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: actions-rust-lang/setup-rust-toolchain@v1

      - name: Cache cargo
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            target
          key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}

      - name: Run cargo check
        run: cargo check --workspace --all-targets

      - name: Verify zero errors
        run: |
          cargo check --workspace 2>&1 | tee check.log
          if grep -q "^error" check.log; then
            echo "❌ Compilation errors detected!"
            exit 1
          fi
          echo "✅ Zero compilation errors"

      - name: Run cargo test
        run: cargo test --workspace

      - name: Verify zero warnings
        run: |
          cargo check --workspace 2>&1 | grep "warning:" > warnings.log || true
          if [ -s warnings.log ]; then
            echo "⚠️  Warnings detected:"
            cat warnings.log
            echo "To achieve zero-warning delivery, fix all warnings"
          fi
```

**Step 2: 添加 pre-commit hook**

创建 `.git/hooks/pre-commit`:

```bash
#!/bin/bash
set -e

echo "🔍 Running pre-commit checks..."

# 快速检查：仅编译不运行测试
cargo check --workspace --all-targets

# 检查是否有编译错误
if cargo check --workspace 2>&1 | grep -q "^error"; then
    echo "❌ Cannot commit: compilation errors detected"
    exit 1
fi

echo "✅ Pre-commit checks passed"
```

```bash
chmod +x .git/hooks/pre-commit
```

**Step 3: 提交 CI 配置**

```bash
git add .github/workflows/baseline-check.yml
git commit -m "ci: add baseline protection checks

- GitHub Actions workflow for CI/CD
- Pre-commit hook to prevent error commits
- Zero-error enforcement
- Automated testing on push/PR

Prevents regression of baseline fixes.

Refs: #baseline-fix"
```

---

## Task 10: 最终验证与文档

**目标:** 确认所有修复完成，建立文档记录

**Step 1: 运行最终验证**

```bash
cd .worktrees/phase-18
./scripts/verify-baseline.sh
```

预期输出:
```
=== Verifying clean baseline ===
1. Running cargo check...
Finished 'dev' profile
2. Running cargo test...
test result: ok. XXX passed, 0 failed
3. Checking for compilation errors...
✅ Clean baseline verified!
   - Zero compilation errors
   - All tests passing
```

**Step 2: 生成修复摘要**

创建 `docs/plans/2026-01-28-baseline-fix-summary.md`:

```markdown
# 编译错误修复摘要

**日期:** 2026-01-28
**分支:** phase-18-release-readiness
**目标:** 建立干净的测试基线

## 修复的错误

### 1. 缺失常量 (1个)
- `WORKFLOW_STATUS_READY` - constants.rs

### 2. Trait 实现错误 (2个)
- `switch_for_terminals` 可见性 - cc_switch.rs:90
- `detect_cli` 可见性 - cc_switch.rs:98

### 3. 导入路径错误 (1个)
- 重复 services 模块 - terminal_coordinator.rs:10

### 4. 缺失函数/类型 (2个)
- `parse_commit_metadata` - git_watcher.rs (agent.rs:191)
- `Issue` 类型 - git_watcher.rs (agent.rs:326)

### 5. SQLx 宏错误 (1个)
- `query!` 离线模式 - runtime.rs:265

### 6. 警告清理 (4个)
- 未使用导入 (3个)
- 不必要括号 (1个)

## 提交历史

1. fix: add missing WORKFLOW_STATUS_READY constant
2. fix: move non-trait methods out of trait impl block
3. fix: correct import path in terminal_coordinator
4. feat: add parse_commit_metadata function
5. feat: add Issue type for git integration
6. fix: replace sqlx::query! with sqlx::query
7. chore: add baseline verification script
8. chore: cleanup compilation warnings
9. ci: add baseline protection checks

## 验证结果

- ✅ 零编译错误
- ✅ 所有测试通过
- ✅ 零警告（除已豁免）
- ✅ CI 自动化检查
- ✅ Pre-commit 钩子

## 后续工作

基线已建立，可以开始 Phase 18 实际开发工作。
```

**Step 3: 合并回主分支（可选）**

```bash
cd .worktrees/phase-18
git push origin phase-18-release-readiness

# 返回主分支
cd ../../
git checkout main
git merge phase-18-release-readiness --no-ff -m "chore: merge baseline fixes to main

- Fixes 9 compilation errors
- Establishes clean test baseline
- Adds CI protection

Resolves #baseline-fix"
```

**Step 4: 最终提交**

```bash
git add docs/plans/2026-01-28-baseline-fix-summary.md
git commit -m "docs: add baseline fix summary

- Documents all 9 compilation errors fixed
- Records commit history and verification results
- Establishes baseline for Phase 18 work

Refs: #baseline-fix"
```

---

## 验收标准

完成所有10个任务后：

✅ **编译检查**
```bash
cargo check --workspace
# 输出: Finished 'dev' profile [unoptimized + debuginfo]
```

✅ **测试通过**
```bash
cargo test --workspace
# 输出: test result: ok. XXX passed, 0 failed
```

✅ **零错误**
```bash
cargo check --workspace 2>&1 | grep "^error" | wc -l
# 输出: 0
```

✅ **CI 检查**
```bash
./scripts/verify-baseline.sh
# 输出: ✅ Clean baseline verified!
```

---

## 下一步

基线修复完成后，使用以下技能继续：

**选项 1: Subagent-Driven Development (本会话)**
- 使用 `superpowers:subagent-driven-development`
- 逐步执行 Phase 18 实际功能开发

**选项 2: Parallel Session (独立会话)**
- 开启新会话在 worktree 中
- 使用 `superpowers:executing-plans`
- Phase 18 批量执行

**推荐:** 选项 1，保持上下文连续性，便于代码审查。
