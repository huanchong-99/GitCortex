# Phase 22: WebSocket 事件广播完善

> **创建日期:** 2026-02-04
> **状态:** 📋 待实施
> **优先级:** 🟡 中（前端体验优化）
> **前置条件:** Phase 21 Git 事件驱动接入完成

---

## 1. 背景与目标

### 1.1 背景

根据设计文档 `docs/developed/plans/2026-01-16-orchestrator-design.md` 第 13 节，系统应支持完整的 WebSocket 事件推送：

| 类别 | 事件 | 说明 |
|------|------|------|
| **工作流** | workflow.status_changed | 工作流状态变更 |
| **终端** | terminal.status_changed | 终端状态变更 |
| **Git** | git.commit_detected | 检测到 Git 提交 |
| **主 Agent** | orchestrator.awakened | 主 Agent 唤醒 |
| | orchestrator.sleeping | 主 Agent 休眠 |
| | orchestrator.decision | 主 Agent 决策 |
| **系统** | system.heartbeat | 心跳 |

当前实现存在以下问题：

- 只有终端 PTY 的 WebSocket（`/terminal/:id`）
- 缺少 workflow/orchestrator/git 事件广播
- 前端 `wsStore` 事件类型与后端不匹配

### 1.2 目标

实现前端实时感知所有状态变化：
- Workflow 状态变化实时推送
- Orchestrator 运行状态与决策事件可见
- Git 提交事件实时展示
- 心跳机制保证连接稳定

---

## 2. 任务拆分

### 2.1 P0 - WebSocket 事件通道设计

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 22.1 | 新增 workflow 事件 WS 路由 `/ws/workflow/:id/events` | ⬜ |  |
| 22.2 | WS 消息格式对齐设计 `{type, payload, timestamp, id}` | ⬜ |  |
| 22.3 | 增加 workflow 级别事件流订阅机制 | ⬜ |  |

### 2.2 P1 - MessageBus 到 WebSocket 桥接

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 22.4 | 转发 `StatusUpdate` 为 `workflow.status_changed` | ⬜ |  |
| 22.5 | 转发 Orchestrator 运行状态为 `orchestrator.awakened/sleeping` | ⬜ |  |
| 22.6 | 转发决策输出为 `orchestrator.decision` | ⬜ |  |
| 22.7 | 转发 GitWatcher 提交为 `git.commit_detected` | ⬜ |  |
| 22.8 | 转发终端状态为 `terminal.status_changed` | ⬜ |  |

### 2.3 P2 - 心跳机制

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 22.9 | 服务端定期发送 `system.heartbeat`（30秒间隔） | ⬜ |  |
| 22.10 | 客户端收到心跳后更新连接时间戳 | ⬜ |  |
| 22.11 | 客户端心跳超时后自动重连 | ⬜ |  |

### 2.4 P3 - 前端订阅与渲染

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 22.12 | 在 workflow 详情页建立 WS 连接 | ⬜ |  |
| 22.13 | 将事件同步到 Zustand wsStore | ⬜ |  |
| 22.14 | PipelineView 实时刷新终端状态 | ⬜ |  |
| 22.15 | TerminalDebugView 实时刷新 | ⬜ |  |
| 22.16 | StatusBar 显示 Orchestrator 状态 | ⬜ |  |

### 2.5 P4 - 测试与回归

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 22.17 | 新增 WS 事件路由测试 | ⬜ |  |
| 22.18 | 新增前端 wsStore 事件处理测试 | ⬜ |  |
| 22.19 | 新增心跳机制测试 | ⬜ |  |
| 22.20 | 新增断线重连测试 | ⬜ |  |

---

## 3. 影响文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `crates/server/src/routes/workflow_ws.rs` | 新增 | Workflow 事件 WS 路由 |
| `crates/server/src/routes/mod.rs` | 修改 | 注册新路由 |
| `crates/services/src/services/orchestrator/message_bus.rs` | 修改 | 添加 WS 广播桥接 |
| `frontend/src/stores/wsStore.ts` | 修改 | 事件处理逻辑 |
| `frontend/src/components/workflow/PipelineView.tsx` | 修改 | 实时状态更新 |
| `frontend/src/components/terminal/TerminalDebugView.tsx` | 修改 | 实时状态更新 |
| `frontend/src/components/workflow/StatusBar.tsx` | 修改 | Orchestrator 状态显示 |

---

## 4. 技术方案

### 4.1 消息协议

```json
{
  "type": "workflow.status_changed",
  "payload": {
    "workflow_id": "uuid",
    "old_status": "ready",
    "new_status": "running"
  },
  "timestamp": 1705420800000,
  "id": "msg_abc123"
}
```

### 4.2 事件类型定义

```typescript
// 前端 wsStore 事件类型
type WsEventType =
  // Workflow
  | 'workflow.created'
  | 'workflow.status_changed'
  | 'workflow.completed'
  | 'workflow.failed'
  // Terminal
  | 'terminal.started'
  | 'terminal.output'
  | 'terminal.status_changed'
  | 'terminal.completed'
  // Git
  | 'git.commit_detected'
  | 'git.branch_created'
  | 'git.merge_started'
  | 'git.merge_completed'
  | 'git.merge_conflict'
  // Orchestrator
  | 'orchestrator.awakened'
  | 'orchestrator.sleeping'
  | 'orchestrator.processing'
  | 'orchestrator.decision'
  // System
  | 'system.heartbeat'
  | 'system.error';
```

### 4.3 心跳机制

```
┌─────────────┐                    ┌─────────────┐
│   Server    │                    │   Client    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ ──── system.heartbeat ────────→ │
       │                                  │ 更新 lastHeartbeat
       │                                  │
       │ ←─── (无响应，单向) ───────────── │
       │                                  │
       │        ... 30秒后 ...            │
       │                                  │
       │ ──── system.heartbeat ────────→ │
       │                                  │
       │                                  │ 如果 60秒无心跳
       │                                  │ 触发重连
```

---

## 5. 验收标准

### 5.1 功能验收

- [ ] Workflow 状态变化可实时推送到前端
- [ ] Orchestrator 运行状态与决策事件可见
- [ ] Git 提交事件可实时展示
- [ ] 心跳稳定且前端可检测连接状态
- [ ] 断线后可自动重连

### 5.2 测试验收

- [ ] 所有现有测试通过
- [ ] 新增 4 个 WebSocket 相关测试
- [ ] 前端事件处理测试覆盖

---

## 6. 风险与依赖

### 6.1 风险

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 大量事件导致前端卡顿 | 中 | 事件节流/防抖 |
| WebSocket 连接数过多 | 中 | 连接池管理 |
| 消息丢失 | 低 | 消息 ID 去重 |

### 6.2 依赖

- Phase 18.5 Zustand stores 实现（wsStore）
- Phase 21 Git 事件驱动接入（GitEvent 来源）

---

## 7. 参考文档

- 设计文档: `docs/developed/plans/2026-01-16-orchestrator-design.md` 第 13 节
- 相关代码: `crates/server/src/routes/terminal_ws.rs`
- 前端参考: `frontend/src/stores/wsStore.ts`
