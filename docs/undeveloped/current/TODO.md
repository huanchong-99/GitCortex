# GitCortex TODO — 审计修复详细执行计划

> 更新时间：2026-03-15
> 目的：本文件是当前唯一的未完成总计划入口。
> 所有已完成阶段（Phase 0-29）已归档至 `docs/developed/`。

## 当前状态

- Phase 0-29 全部交付完成。
- 全量代码审计（36组6轮）已完成，报告归档至 `docs/developed/issues/2026-03-14-full-code-audit-master.md`。
- 审计修复 Batch 1-7（后端核心）✅ 已完成，~107 个 G-ID 已修复，12 个 verified 无需修复。
- 审计修复 Batch 8-10（前端+辅助模块）⚠️ 部分完成，~190 个 G-ID 待修复。
- CI 状态：✅ 全绿。

## 执行策略

- **20 个 Agent 并行开发**，每个 Agent 负责一组文件依赖隔离的修复任务。
- 分组原则：同一文件只分配给一个 Agent，有 import 依赖的文件尽量归入同一 Agent。
- 每个 Agent 只要涉及文件索引，**100% 必须使用 augment-code MCP**。
- 分为 3 个 Phase（Wave），Phase 内的 Agent 可完全并行，Phase 间串行。
- Phase 间存在依赖关系（详见各 Phase 文件末尾的「跨 Phase 依赖」表格）。

## Phase 计划文件

| Phase | 文件 | Agent 数 | G-ID 数 | 说明 |
|-------|------|----------|---------|------|
| Phase 0 | `XX-phase-0-backend-foundation.md` | 8 (Agent 1-8) | ~74 | 后端基础层：orchestrator/git/terminal/worktree/events-SSE/task-attempts/types-utils |
| Phase 1 | `XX-phase-1-frontend-core.md` | 7 (Agent 9-15) | ~76 | 前端核心：Workflows/useWorkflows/wsStore/debug页/wizard/api+contexts/icon+i18n |
| Phase 2 | `XX-phase-2-integration.md` | 5 (Agent 16-20) | ~25 | 集成层：Feishu 全栈/Task Attempts 前端/跨模块验证/文档同步 |

## Agent 总览

### Phase 0 — 后端基础层（8 个 Agent，完全并行）

| Agent | 名称 | 独占文件 | G-ID 数 | 核心修复 |
|-------|------|---------|---------|----------|
| 1 | Orchestrator: Pause/Resume/Stop/Recovery | agent.rs(pause/stop), runtime.rs, persistence.rs, workflows.rs(pause/stop) | 11 | pause 级联、resume 端点、recovery 改进、auto_dispatch 并行化 |
| 2 | Orchestrator: Merge + Quality Gate + LLM | agent.rs(merge/quality), merge_coordinator.rs, state.rs, workflows.rs(merge) | 19 | merge CAS/互斥/回滚、quality 超时/幂等、provider 耗尽终止 |
| 3 | Git Watcher + Git CLI | git_watcher.rs, git/cli.rs, git_event.rs | 7 | git log --all、checkpoint 跳过、metadata 双路径合并 |
| 4 | Terminal / PTY 进程管理 | process.rs, bridge.rs, output_fanout.rs, launcher.rs(broadcast), terminal_ws.rs, runtime_actions.rs(close) | 13 | WS seq 续传、进程存活检查、优雅关闭、ProcessManager Drop |
| 5 | Worktree 管理 | worktree_manager.rs, workspace_manager.rs(orphan), workflows.rs(worktree) | 9 | LOCKS LRU、branch 冲突检查、stop/merge 后清理 |
| 6 | Events / SSE / Subscription | streams.rs, events.rs, msg_store.rs, patches.rs, subscription_hub.rs(TTL) | 10 | Lagged resync、Remove 鉴权、连接限制、内存预警 |
| 7 | Task Attempts / PR 后端 | task_attempts.rs, pr.rs, workspace_summary.rs, util.rs, 新 migration | 10 | PR 创建验证/错误传播、并发保护、事务回滚、diff 并发限制 |
| 8 | 类型生成 / 工具函数 | generate_types.rs, text.rs, port_file.rs, path.rs, workflow_events.rs(TS标注) | 5 | WsEvent/WsEventType 导出、Regex 缓存、路径统一 |

### Phase 1 — 前端核心（7 个 Agent，完全并行）

| Agent | 名称 | 独占文件 | G-ID 数 | 核心修复 |
|-------|------|---------|---------|----------|
| 9 | Workflows.tsx 页面 | Workflows.tsx | 14 | prompt dedup/超时/队列、操作互斥、WS 断开警告、轮询→WS |
| 10 | useWorkflows + React Query | useWorkflows.ts, main.tsx(QueryClient) | 10 | optimistic updates 统一、onError invalidation、retry 策略 |
| 11 | wsStore.ts WebSocket | wsStore.ts | 9 | handler 泄漏修复、useRef 缓存、lagged resync、重连放弃通知 |
| 12 | Debug 页面 | WorkflowDebugPage.tsx, TerminalDebugView.tsx, TerminalEmulator.tsx | 12 | status mapping、轮询→WS、WS 泄漏修复、虚拟滚动 |
| 13 | Wizard 验证器 + 类型 | validators/*.ts, types.ts, WorkflowWizard.tsx(handleNext) | 10 | 全链路验证、branch 唯一性、model 必填项、errorTerminal 配置 |
| 14 | api.ts + Contexts + Board | api.ts(imagesApi/oauthApi), TabNavigationContext.tsx, SearchContext.tsx, Board.tsx(quality) | 6 | 统一 handleApiResponse、Provider 补全、quality invalidation |
| 15 | Icon 迁移 + i18n | DisplayConversationEntry.tsx, Step*.tsx(icon), i18n/config.ts, 新 locale JSON | 6 | lucide→phosphor 统一迁移、4 语言 namespace 补全、fallback chain |

### Phase 2 — 集成层（5 个 Agent，完全并行）

| Agent | 名称 | 独占文件 | G-ID 数 | 核心修复 |
|-------|------|---------|---------|----------|
| 16 | Feishu 后端核心 | auth.rs, client.rs, messages.rs, reconnect.rs | 9 | token TOCTOU、WS 连接时序、ping CancellationToken、指数退避 |
| 17 | Feishu 路由 + 事件 | feishu.rs, events.rs, health.rs, main.rs(connected), 新 migration | 7 | bind 验证、config update、unique 约束、AtomicBool 连接状态 |
| 18 | Feishu 前端 + PR Dialog | FeishuSettings.tsx, PrCommentsDialog.tsx | 4 | icon 迁移、auto-reconnect、i18n 硬编码消除 |
| 19 | Task Attempts 前端 + 状态对齐 | 新 migration(if needed), workflowStatus.ts | 2 | merges unique 约束验证、前端状态与后端新增状态对齐 |
| 20 | 跨模块验证 + 文档 | audit-fix-status.md, TODO.md, CLAUDE.md | 1+10验证 | 全量测试/lint/构建验证、audit 状态更新、文档同步 |

## 文件独占矩阵（关键冲突点）

以下文件被多个 Agent 修改，通过**修改区域隔离**确保无冲突：

| 文件 | Agent(s) | 隔离方式 |
|------|----------|----------|
| `agent.rs` (4700+行) | Agent 1 (pause/stop L2800-L3200), Agent 2 (merge/quality L1160-L1530, L4370+) | 函数级隔离，行号区域不重叠 |
| `workflows.rs` (2750+行) | Agent 1 (L1580-L1720), Agent 2 (L2660-L2750), Agent 5 (L840-L880, L1350-L1390) | 行号区域隔离 |
| Wizard Step*.tsx | Agent 13 (引用的 validators/types), Agent 15 (icon import 行) | 修改区域不重叠 |
| `subscription_hub.rs` | Agent 6 (pending_events TTL 新增) | 仅新增代码，不改现有逻辑 |

## 跨 Phase 依赖关系

```
Phase 0 (Backend)  ──串行──>  Phase 1 (Frontend)  ──串行──>  Phase 2 (Integration)

关键依赖链：
├─ Agent 2 (G31-002 backend) → Agent 11 (G31-002 frontend wsStore 类型)
├─ Agent 2 (merge progress events) → Agent 9 (G26-007 merge 进度订阅)
├─ Agent 4 (terminal WS 稳定) → Agent 12 (G28-003 debug WS 订阅)
├─ Agent 1 (paused 状态) → Agent 19 (前端状态对齐)
├─ Agent 2 (merge_partial_failed 状态) → Agent 19 (前端状态对齐)
└─ Agent 16 (G32-017 AtomicBool) → Agent 17 (G32-015 health 查询)
```

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| agent.rs Agent 1/2 修改区域意外重叠 | 合并冲突 | 明确行号边界，Phase 0 完成后立即集成检查 |
| Phase 0 backend 修改导致前端测试失败 | Phase 1 启动受阻 | Phase 0 结束后执行全量前端测试验证 |
| Feishu reconnect.rs 需新增 `rand` 依赖 | Cargo.lock 冲突 | Agent 16 独占 feishu-connector/Cargo.toml |
| i18n 新增 locale JSON 文件可能遗漏 key | 运行时 fallback | Phase 1 Agent 15 完成后执行 `lint:i18n` 验证 |
| 虚拟滚动（react-virtuoso）引入新依赖 | bundle size 增加 | Agent 12 评估 react-virtuoso vs 分页方案，选择最小化方案 |

## 既有 Backlog

| ID | 描述 | 优先级 |
|----|------|--------|
| BACKLOG-001 | Docker Deployment 抽象 | 低 |
| BACKLOG-002 | Runner 容器分离 | 低 |
| BACKLOG-003 | CLI 安装状态 API | 中 |
| BACKLOG-004 | K8s 部署支持 | 低 |
| BACKLOG-005 | 镜像体积优化 | 中 |

## 文档入口

- 已完成任务清单：`docs/developed/misc/TODO-completed.md`
- 全量代码审计报告：`docs/developed/issues/2026-03-14-full-code-audit-master.md`
- 审计修复状态跟踪：`docs/undeveloped/current/2026-03-14-audit-fix-status.md`
- Phase 0 详细计划：`docs/undeveloped/current/XX-phase-0-backend-foundation.md`
- Phase 1 详细计划：`docs/undeveloped/current/XX-phase-1-frontend-core.md`
- Phase 2 详细计划：`docs/undeveloped/current/XX-phase-2-integration.md`

## 维护规则

1. 新完成事项从本文件移除，同步更新 `docs/developed/misc/TODO-completed.md`。
2. 本文件仅保留当前未完成计划、风险和 backlog。
3. 里程碑完成后，归档到 `docs/developed/`。
4. 每个 Phase 完成后更新本文件的 Agent 总览表（标记 ✅）。
