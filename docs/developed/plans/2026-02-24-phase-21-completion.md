# Phase 21 完成计划：Git 事件持久化 + Workflow Git 监测开关

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成 Phase 21 剩余的 21.10（Git 事件写入 DB）和 21.12（Workflow 级别 Git 监测开关）

**Architecture:** 21.10 在 OrchestratorAgent 处理 git 事件时写入已有的 `git_event` 表并跟踪状态生命周期；21.12 通过新 migration 给 workflow 表加 `git_watcher_enabled` 字段，后端/前端联动控制 GitWatcher 启停。

**Tech Stack:** Rust (SQLx offline mode), React + TypeScript + i18n, SQLite

---

## Task 1: 创建 GitEvent Model（DB 层）

**Files:**
- Create: `crates/db/src/models/git_event.rs`
- Modify: `crates/db/src/models/mod.rs`

**Context:** `git_event` 表已存在于 migration `20260117000001_create_workflow_tables.sql`（第 253-278 行），schema: id TEXT PK, workflow_id TEXT FK, terminal_id TEXT, commit_hash TEXT, branch TEXT, commit_message TEXT, metadata TEXT, process_status TEXT DEFAULT 'pending', agent_response TEXT, created_at TEXT, processed_at TEXT。无需新建 migration。

**Step 1: 创建 `crates/db/src/models/git_event.rs`**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitEvent {
    pub id: String,
    pub workflow_id: String,
    pub terminal_id: Option<String>,
    pub commit_hash: String,
    pub branch: String,
    pub commit_message: String,
    pub metadata: Option<String>,
    pub process_status: String,
    pub agent_response: Option<String>,
    pub created_at: DateTime<Utc>,
    pub processed_at: Option<DateTime<Utc>>,
}

impl GitEvent {
    pub async fn insert(pool: &SqlitePool, event: &GitEvent) -> sqlx::Result<()> {
        sqlx::query(
            r"INSERT INTO git_event (id, workflow_id, terminal_id, commit_hash, branch, commit_message, metadata, process_status, created_at)
              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
        )
        .bind(&event.id)
        .bind(&event.workflow_id)
        .bind(&event.terminal_id)
        .bind(&event.commit_hash)
        .bind(&event.branch)
        .bind(&event.commit_message)
        .bind(&event.metadata)
        .bind(&event.process_status)
        .bind(event.created_at)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn update_status(
        pool: &SqlitePool,
        id: &str,
        status: &str,
        agent_response: Option<&str>,
    ) -> sqlx::Result<()> {
        let processed_at = if status == "processed" || status == "failed" {
            Some(Utc::now())
        } else {
            None
        };
        sqlx::query(
            r"UPDATE git_event SET process_status = ?1, agent_response = ?2, processed_at = ?3 WHERE id = ?4"
        )
        .bind(status)
        .bind(agent_response)
        .bind(processed_at)
        .bind(id)
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn find_by_workflow(pool: &SqlitePool, workflow_id: &str) -> sqlx::Result<Vec<Self>> {
        sqlx::query_as::<_, GitEvent>(
            r"SELECT * FROM git_event WHERE workflow_id = ? ORDER BY created_at DESC"
        )
        .bind(workflow_id)
        .fetch_all(pool)
        .await
    }
}
```

**Step 2: 注册模块到 `crates/db/src/models/mod.rs`**

在 `pub mod workflow;` 之后添加：
```rust
pub mod git_event;

pub use git_event::*;
```

**Step 3: 编译验证**

Run: `cd crates/db && cargo check`
Expected: 编译通过

**Step 4: Commit**

```bash
git add crates/db/src/models/git_event.rs crates/db/src/models/mod.rs
git commit -m "feat(db): add GitEvent model with CRUD for git_event table (21.10)"
```

---

## Task 2: 在 OrchestratorAgent 中集成 Git 事件持久化

**Files:**
- Modify: `crates/services/src/services/orchestrator/agent.rs`

**Context:**
- `OrchestratorAgent` 持有 `db: Arc<DBService>`（agent.rs:43），`DBService` 有 `pool: SqlitePool`
- `handle_git_event()` 在 agent.rs:743-858 处理所有 git 事件
- `handle_git_event_no_metadata()` 在 agent.rs:868-900 处理无 metadata 的提交
- `CommitMetadata` 来自 `crate::services::git_watcher::CommitMetadata`，可序列化为 JSON

**Step 1: 在 `handle_git_event()` 方法中，解析 metadata 之前插入 git_event 记录**

在 agent.rs 的 `handle_git_event` 方法中，idempotency 检查之后（约第 764 行 `return Ok(())` 之后），metadata 解析之前，插入：

```rust
// Insert git_event record with 'pending' status
let event_id = uuid::Uuid::new_v4().to_string();
let git_event = db::models::GitEvent {
    id: event_id.clone(),
    workflow_id: workflow_id.to_string(),
    terminal_id: None, // will be set after metadata parse
    commit_hash: commit_hash.to_string(),
    branch: branch.to_string(),
    commit_message: message.to_string(),
    metadata: None,
    process_status: "pending".to_string(),
    agent_response: None,
    created_at: chrono::Utc::now(),
    processed_at: None,
};
if let Err(e) = db::models::GitEvent::insert(&self.db.pool, &git_event).await {
    tracing::warn!("Failed to persist git_event: {}", e);
    // Non-fatal: continue processing even if DB write fails
}
```

**Step 2: metadata 解析成功后，更新 terminal_id 和 metadata JSON，设置 status='processing'**

在 metadata 解析成功、workflow_id 验证通过后（约第 800 行 processed_commits insert 之后），添加：

```rust
// Update git_event with parsed metadata
let metadata_json = serde_json::to_string(&metadata).ok();
let _ = sqlx::query("UPDATE git_event SET terminal_id = ?1, metadata = ?2, process_status = 'processing' WHERE id = ?3")
    .bind(&metadata.terminal_id)
    .bind(&metadata_json)
    .bind(&event_id)
    .execute(&*self.db.pool)
    .await;
```

**Step 3: 在 status routing match 结束后（约第 855 行），更新为 'processed' 或 'failed'**

将 match 块的结果捕获，然后更新状态：

```rust
// After the match block, update final status
let _ = db::models::GitEvent::update_status(&self.db.pool, &event_id, "processed", None).await;
```

对于 unknown status 分支和 workflow_id mismatch 分支，更新为 'failed'。

**Step 4: 在 `handle_git_event_no_metadata()` 中，更新 event 状态为 'processing' 然后 'processed'**

在 `handle_git_event_no_metadata` 方法签名中增加 `event_id: &str` 参数，在调用处传入。在方法体内 awaken 之后：

```rust
let _ = db::models::GitEvent::update_status(&self.db.pool, event_id, "processed", None).await;
```

**Step 5: 编译验证**

Run: `cargo check -p services`
Expected: 编译通过

**Step 6: Commit**

```bash
git add crates/services/src/services/orchestrator/agent.rs
git commit -m "feat(orchestrator): persist git events to DB with lifecycle tracking (21.10)"
```

---

## Task 3: 新增 Migration 添加 git_watcher_enabled 字段

**Files:**
- Create: `crates/db/migrations/20260224000000_add_git_watcher_enabled.sql`

**Context:** `workflow` 表当前无 `git_watcher_enabled` 字段。SQLite 用 INTEGER 表示 boolean（0/1），默认启用（1）以保持向后兼容。

**Step 1: 创建 migration 文件**

```sql
-- Add git_watcher_enabled column to workflow table
-- Default TRUE (1) to maintain backward compatibility
ALTER TABLE workflow ADD COLUMN git_watcher_enabled INTEGER NOT NULL DEFAULT 1;
```

**Step 2: Commit**

```bash
git add crates/db/migrations/20260224000000_add_git_watcher_enabled.sql
git commit -m "feat(db): add git_watcher_enabled column to workflow table (21.12)"
```

---

## Task 4: 更新 Workflow Rust Model 和 CRUD

**Files:**
- Modify: `crates/db/src/models/workflow.rs`

**Context:**
- `Workflow` struct 在 workflow.rs:101-171
- `CreateWorkflowRequest` 在 workflow.rs:420-443
- `Workflow::create()` 在 workflow.rs:482-518（显式列出所有字段）
- `Workflow::create_with_tasks()` 在 workflow.rs:691-788（显式列出所有字段）
- `SELECT *` 查询会自动包含新字段，但 INSERT 需要手动添加

**Step 1: 在 `Workflow` struct 中添加字段**

在 `target_branch` 字段（workflow.rs:155）之后添加：

```rust
/// Enable git watcher for this workflow
#[serde(default = "default_true")]
pub git_watcher_enabled: bool,
```

在文件顶部附近添加辅助函数（或复用已有的）：
```rust
fn default_true() -> bool { true }
```

**Step 2: 在 `CreateWorkflowRequest` 中添加字段**

在 `target_branch` 字段（workflow.rs:438）之后添加：

```rust
/// Enable git watcher (default true)
pub git_watcher_enabled: Option<bool>,
```

**Step 3: 更新 `Workflow::create()` INSERT 语句**

在 INSERT 列列表中添加 `git_watcher_enabled`，VALUES 中添加对应的 `?20`，并添加 `.bind(workflow.git_watcher_enabled)`。

**Step 4: 更新 `Workflow::create_with_tasks()` INSERT 语句**

同上，在事务中的 workflow INSERT 添加 `git_watcher_enabled` 字段和绑定。

**Step 5: 更新所有构造 Workflow 实例的地方**

搜索所有创建 `Workflow { ... }` 的代码（包括测试），添加 `git_watcher_enabled: true`（或从 request 读取）。

**Step 6: 编译验证**

Run: `cargo check -p db`
Expected: 编译通过

**Step 7: Commit**

```bash
git add crates/db/src/models/workflow.rs
git commit -m "feat(db): add git_watcher_enabled to Workflow model and CreateWorkflowRequest (21.12)"
```

---

## Task 5: 更新 Runtime 检查 git_watcher_enabled

**Files:**
- Modify: `crates/services/src/services/orchestrator/runtime.rs`

**Context:** `try_start_git_watcher()` 在 runtime.rs:118-197，当前无条件启动 watcher。需要在方法开头检查 `workflow.git_watcher_enabled`。

**Step 1: 在 `try_start_git_watcher()` 方法开头添加检查**

在 runtime.rs:122（`// Get project to find repo path` 之前）添加：

```rust
if !workflow.git_watcher_enabled {
    info!("Git watcher disabled for workflow {}, skipping", workflow_id);
    return Ok(None);
}
```

**Step 2: 编译验证**

Run: `cargo check -p services`
Expected: 编译通过

**Step 3: Commit**

```bash
git add crates/services/src/services/orchestrator/runtime.rs
git commit -m "feat(runtime): respect git_watcher_enabled flag when starting watcher (21.12)"
```

---

## Task 6: 更新后端 Workflow 创建路由

**Files:**
- Modify: 创建 workflow 的路由处理函数（构造 `Workflow` struct 的地方）

**Context:** 需要找到从 `CreateWorkflowRequest` 构造 `Workflow` 实例的代码，将 `git_watcher_enabled` 从 request 传入。

**Step 1: 搜索构造 Workflow 实例的路由代码**

Run: `grep -rn "Workflow {" crates/server/src/`

**Step 2: 在构造 Workflow 时读取 request 的 git_watcher_enabled**

```rust
git_watcher_enabled: req.git_watcher_enabled.unwrap_or(true),
```

**Step 3: 编译验证**

Run: `cargo check -p server`
Expected: 编译通过

**Step 4: Commit**

```bash
git add crates/server/
git commit -m "feat(server): pass git_watcher_enabled from request to workflow creation (21.12)"
```

---

## Task 7: 更新前端类型和 API

**Files:**
- Modify: `frontend/src/components/workflow/types.ts`
- Modify: `frontend/src/hooks/useWorkflows.ts`

**Context:**
- `AdvancedConfig` 在 types.ts:124-140
- `wizardConfigToCreateRequest()` 在 types.ts:204-301
- `CreateWorkflowRequest` 在 useWorkflows.ts:145-196

**Step 1: 在 `AdvancedConfig` 中添加 gitWatcher 配置**

在 `targetBranch` 字段（types.ts:139）之后添加：

```typescript
gitWatcherEnabled: boolean;
```

**Step 2: 更新 `getDefaultWizardConfig()` 默认值**

在 advanced 默认配置中添加：
```typescript
gitWatcherEnabled: true,
```

**Step 3: 在 `CreateWorkflowRequest` 中添加字段**

在 useWorkflows.ts 的 `targetBranch` 之后添加：
```typescript
gitWatcherEnabled?: boolean;
```

**Step 4: 更新 `wizardConfigToCreateRequest()` 传递字段**

在 request 对象中添加：
```typescript
gitWatcherEnabled: config.advanced.gitWatcherEnabled,
```

**Step 5: Commit**

```bash
git add frontend/src/components/workflow/types.ts frontend/src/hooks/useWorkflows.ts
git commit -m "feat(frontend): add gitWatcherEnabled to types and API request (21.12)"
```

---

## Task 8: 更新前端 UI 和 i18n

**Files:**
- Modify: `frontend/src/components/workflow/steps/Step6Advanced.tsx`
- Modify: `frontend/src/i18n/locales/zh-Hans/workflow.json`
- Modify: `frontend/src/i18n/locales/en/workflow.json`

**Context:**
- Step6Advanced 组件在 Step6Advanced.tsx:1-333
- 在 targetBranch 字段之前添加 git 监测开关（checkbox，与 errorTerminal 开关风格一致）
- i18n 的 step6 section 在 workflow.json:270

**Step 1: 在 Step6Advanced 组件中添加 handler**

在 `handleTargetBranchChange` 之后添加：

```typescript
const handleGitWatcherEnabledChange = (enabled: boolean) => {
  onUpdate({
    advanced: {
      ...advancedConfig,
      gitWatcherEnabled: enabled,
    },
  });
};
```

**Step 2: 在 JSX 中添加 checkbox（targetBranch Field 之前）**

```tsx
<Field>
  <div className="flex items-center gap-base">
    <input
      type="checkbox"
      id="gitWatcherEnabled"
      checked={advancedConfig.gitWatcherEnabled}
      onChange={(e) => handleGitWatcherEnabledChange(e.target.checked)}
      className="size-icon-sm accent-brand"
    />
    <FieldLabel htmlFor="gitWatcherEnabled" className="mb-0">
      {t('step6.gitWatcher.enableLabel')}
    </FieldLabel>
  </div>
  <div className="text-sm text-low">
    {t('step6.gitWatcher.description')}
  </div>
</Field>
```

**Step 3: 添加 i18n 翻译**

zh-Hans/workflow.json 的 step6 中添加：
```json
"gitWatcher": {
  "enableLabel": "启用 Git 提交监测",
  "description": "自动监测 Git 提交并触发事件驱动的工作流推进"
}
```

en/workflow.json 的 step6 中添加：
```json
"gitWatcher": {
  "enableLabel": "Enable Git commit monitoring",
  "description": "Automatically detect Git commits and trigger event-driven workflow progression"
}
```

**Step 4: Commit**

```bash
git add frontend/src/components/workflow/steps/Step6Advanced.tsx
git add frontend/src/i18n/locales/zh-Hans/workflow.json
git add frontend/src/i18n/locales/en/workflow.json
git commit -m "feat(frontend): add git watcher toggle UI in advanced config (21.12)"
```

---

## Task 9: 重新生成 SQLx 离线缓存

**Files:**
- Modify: `.sqlx/*.json`

**Context:** 项目使用 `SQLX_OFFLINE=true`，新增的 SQL 查询需要重新生成缓存文件。需要先运行 migration 到本地 DB，再用 `cargo sqlx prepare` 生成。

**Step 1: 运行 migration 并重新生成缓存**

```bash
# 确保 DATABASE_URL 指向本地 SQLite
cargo sqlx database create 2>/dev/null || true
cargo sqlx migrate run --source crates/db/migrations
cargo sqlx prepare --workspace
```

**Step 2: 全量编译验证**

Run: `SQLX_OFFLINE=true cargo check`
Expected: 编译通过

**Step 3: Commit**

```bash
git add .sqlx/
git commit -m "chore(sqlx): regenerate offline query cache for git_event and git_watcher_enabled"
```

---

## Task 10: 更新文档

**Files:**
- Modify: `docs/developed/plans/2026-02-04-phase-21-git-event-driven.md`
- Modify: `docs/undeveloped/current/TODO-pending.md`
- Modify: `docs/developed/misc/TODO-completed.md`

**Step 1: 更新 Phase 21 计划文档**

将 21.10 和 21.12 的状态从 ⬜ 改为 ✅，添加完成时间。

**Step 2: 更新 TODO-pending.md**

移除 21.10 和 21.12 条目（已完成）。

**Step 3: 更新 TODO-completed.md**

将 Phase 21 状态从 "✅ 已完成（含 2 项遗留）" 改为 "✅ 已完成"。

**Step 4: Commit**

```bash
git add docs/
git commit -m "docs: mark Phase 21 tasks 21.10 and 21.12 as completed"
```
