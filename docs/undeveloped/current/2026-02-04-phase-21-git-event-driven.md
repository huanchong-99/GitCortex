# Phase 21: Git 事件驱动接入

> **创建日期:** 2026-02-04
> **状态:** 📋 待实施
> **优先级:** 🔴 高（核心功能实现）
> **前置条件:** Phase 20 自动化协调核心完成

---

## 1. 背景与目标

### 1.1 背景

根据设计文档 `docs/developed/plans/2026-01-16-orchestrator-design.md` 第 6 节，系统应采用事件驱动模式：

```
✗ 错误方式 (轮询):
  主 Agent 每隔 N 秒检查终端状态 → 大量 token 消耗

✓ 正确方式 (事件驱动):
  Git 监测服务检测到提交 → 唤醒主 Agent → 主 Agent 处理
```

当前实现存在以下问题：

- `GitWatcher` 服务代码存在，但**未在部署启动或 workflow 流程中初始化**
- `MessageBus` 有 `GitEvent` 变体但缺少发布入口
- 生产代码中没有调用 `GitWatcher::new`（仅测试中使用）

### 1.2 目标

实现 Git 提交后唤醒主 Agent 的事件驱动闭环：
- Workflow 启动时自动初始化 GitWatcher
- Git 提交检测后发布 GitEvent 到 MessageBus
- Orchestrator 响应 GitEvent 并决策下一步

---

## 2. 任务拆分

### 2.1 P0 - GitWatcher 生命周期接入

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 21.1 | 在 workflow 启动时初始化 GitWatcher | ⬜ |  |
| 21.2 | 在 workflow 停止/完成时释放 GitWatcher | ⬜ |  |
| 21.3 | GitWatcher 与 workflow_id 建立关联 | ⬜ |  |
| 21.4 | 从 project/workspace 获取 repo path 作为 watcher 目录 | ⬜ |  |

### 2.2 P1 - Git 提交事件上报 MessageBus

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 21.5 | 增加 `MessageBus::publish_git_event` 方法或复用 `publish` | ⬜ |  |
| 21.6 | 将 commit hash、branch、message 写入 `BusMessage::GitEvent` | ⬜ |  |
| 21.7 | 解析 commit message 中的 METADATA 格式 | ⬜ |  |

### 2.3 P2 - Orchestrator 响应 GitEvent

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 21.8 | 对含 metadata 的提交走现有 `handle_git_event` 逻辑 | ⬜ |  |
| 21.9 | 对无 metadata 的提交触发"唤醒"决策逻辑 | ⬜ |  |
| 21.10 | 将 Git 事件写入 `git_event` 表并更新处理状态 | ⬜ |  |

### 2.4 P3 - 配置项支持

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 21.11 | 支持 GitWatcher polling interval 配置 | ⬜ |  |
| 21.12 | 支持 workflow 级别 Git 监测开关（可选） | ⬜ |  |

### 2.5 P4 - 测试与回归

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 21.13 | 新增 GitWatcher 启动接入测试 | ⬜ |  |
| 21.14 | 新增 GitEvent 发布测试 | ⬜ |  |
| 21.15 | 新增 Orchestrator GitEvent 响应测试 | ⬜ |  |
| 21.16 | 新增 METADATA 解析测试 | ⬜ |  |

---

## 3. 影响文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `crates/services/src/services/git_watcher.rs` | 修改 | 添加生命周期管理 |
| `crates/services/src/services/orchestrator/agent.rs` | 修改 | 添加 GitEvent 响应 |
| `crates/services/src/services/orchestrator/message_bus.rs` | 修改 | 添加 GitEvent 发布 |
| `crates/server/src/routes/workflows.rs` | 修改 | 启动时初始化 GitWatcher |
| `crates/local-deployment/src/lib.rs` | 修改 | 注册 GitWatcher 服务 |
| `crates/db/src/models/git_event.rs` | 新增/修改 | Git 事件持久化 |

---

## 4. 技术方案

### 4.1 GitWatcher 初始化流程

```
Workflow Start
    │
    ▼
获取 project.default_agent_working_dir
    │
    ▼
创建 GitWatcher(repo_path, workflow_id)
    │
    ▼
注册到 OrchestratorRuntime
    │
    ▼
开始监听 .git/refs/heads/
```

### 4.2 Git 事件处理流程

```
Git Commit 检测
    │
    ▼
解析 Commit Message
    │
    ├─── 有 METADATA ───→ handle_git_event(metadata)
    │                          │
    │                          ▼
    │                     更新终端状态
    │                     触发下一终端
    │
    └─── 无 METADATA ───→ 唤醒 Orchestrator
                               │
                               ▼
                          LLM 决策下一步
```

### 4.3 METADATA 格式

```
[Terminal:{terminal_id}] [Status:{status}] {summary}

{详细描述}

---METADATA---
workflow_id: {workflow_id}
task_id: {task_id}
terminal_order: {order}
cli: {cli_type}
model: {model}
status: {completed|review_pass|review_reject|failed}
next_action: {continue|retry|merge}
```

---

## 5. 验收标准

### 5.1 功能验收

- [ ] Workflow 启动后自动初始化 GitWatcher
- [ ] Workflow 停止后自动释放 GitWatcher
- [ ] Git 提交可触发 `GitEvent` 并唤醒 Orchestrator
- [ ] 含 METADATA 的提交可正确解析并更新状态
- [ ] Git 事件可落库并更新状态

### 5.2 测试验收

- [ ] 所有现有测试通过
- [ ] 新增 4 个 Git 事件相关测试
- [ ] 集成测试覆盖完整流程

---

## 6. 风险与依赖

### 6.1 风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 文件系统监听性能 | 中 | 使用 polling 模式，可配置间隔 |
| 多 workflow 监听同一仓库 | 中 | 按 workflow_id 隔离事件 |
| METADATA 解析失败 | 低 | 降级为普通唤醒 |

### 6.2 依赖

- Phase 20 自动化协调核心（Orchestrator 响应事件）
- Phase 5 GitWatcher 基础实现

---

## 7. 参考文档

- 设计文档: `docs/developed/plans/2026-01-16-orchestrator-design.md` 第 6 节
- 相关代码: `crates/services/src/services/git_watcher.rs`
- 测试参考: `crates/services/tests/git_watcher_integration_test.rs`
