# Phase 2 — 集成层修复（Agent 16-20，完全并行）

> 前置条件：Phase 0 + Phase 1 全部完成并通过集成检查。
> 预计产出：Feishu 集成完善、Task Attempts 前端修复、跨模块集成验证通过。
> Phase 内 5 个 Agent 完全并行，无文件交叉。
> **每个 Agent 只要涉及文件索引，100% 必须使用 augment-code MCP。**

---

## Agent 16 — Feishu 后端核心（Auth / Client / Messages / Reconnect）

**负责文件（独占）：**
- `crates/feishu-connector/src/auth.rs`
- `crates/feishu-connector/src/client.rs`
- `crates/feishu-connector/src/messages.rs`
- `crates/feishu-connector/src/reconnect.rs`

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G32-001 | P1 | `refresh_tenant_token` 存在 TOCTOU 竞态：并发刷新请求可能同时进入 | 使用 double-check locking 模式：先 read-lock 检查 token 是否过期，过期则升级到 write-lock 并再次检查 |
| G32-002 | P1 | WS 在连接建立前就设置 `connected=true` | 将 `connected = true` 移到 `connect_async` 成功之后 |
| G32-003 | P2 | Ping loop 在连接关闭后最多需要 120s 才能终止 | 使用 `CancellationToken`：连接关闭时触发 cancel，ping loop `select!` cancel 信号 |
| G32-004 | P2 | Ping task 的 `JoinHandle` 被 drop，cleanup 不保证 | 保存 `JoinHandle` 到结构体字段，在 `disconnect()` 时 `.abort()` + `.await` |
| G32-005 | P2 | Message send API 不检查 Feishu 响应的 business error code | 检查 `resp["code"] != 0`，非零时返回 `Err(FeishuApiError { code, msg })` |
| G32-010 | P2 | `rand_jitter` 使用系统时间纳秒作为伪随机源 | 使用 `rand` crate 的 `thread_rng().gen_range(0..max_jitter_ms)` |
| G32-011 | P2 | `ReconnectPolicy` 未实现指数退避 | 实现 `base_ms * 2^attempt`，带上限 cap（max 120s）和随机 jitter |
| G32-012 | P3 | `FeishuEvent` 解析失败仅 debug 日志 | 提升为 `warn!` 级别，包含原始 payload 摘要 |
| G32-013 | P3 | `parse_message_event` 对缺失字段使用 `unwrap_or_default`，空 `chat_id` 被静默处理 | 关键字段（chat_id, message_id）改用 `ok_or_else()`，缺失时返回解析错误 |

**注意事项：**
- auth.rs 的 token 刷新是关键路径，竞态修复需充分测试
- client.rs 修改涉及 WS 连接生命周期管理，需确保 CancellationToken 正确传播
- reconnect.rs 需添加 `rand` 依赖到 `crates/feishu-connector/Cargo.toml`
- 修改后运行 `cargo test --package feishu-connector` 验证
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 17 — Feishu 路由 + 事件处理 + Health

**负责文件（独占）：**
- `crates/feishu-connector/src/feishu.rs`（路由处理函数）
- `crates/feishu-connector/src/events.rs`（事件解析）
- `crates/feishu-connector/src/health.rs`
- `crates/feishu-connector/src/main.rs`（仅 connected 状态设置）
- `crates/db/migrations/` 下新建 migration 文件（feishu_app_config unique 约束）

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G32-006 | P2 | `/bind` 命令不验证 `workflow_id` 格式或存在性 | 添加 UUID 格式验证 + DB 查询确认 workflow 存在 |
| G32-007 | P2 | `update_config` 使用 `find_enabled` 查找，disabled 的配置无法更新 | 改用 `find_first()` 或 `find_by_id()` 不过滤 enabled 状态 |
| G32-008 | P2 | `feishu_app_config` 表缺少唯一约束，同一 app_id 可重复插入 | 新建 migration 添加 `UNIQUE(app_id)` 约束；insert 改用 `INSERT OR REPLACE` |
| G32-009 | P2 | reconnect 路由在 `try_send` 失败时仍返回 success | 失败时返回 `429 Too Many Requests` 或 `409 Conflict`，附带错误描述 |
| G32-015 | P3 | Health 路由硬编码 Feishu 状态为 "disconnected" | 查询实际连接状态（通过 Agent 16 修复后的 `is_connected()` API） |
| G32-016 | P3 | `forward_to_orchestrator` 使用 `TerminalMessage` 语义不匹配 | 新增 `ExternalChatMessage` 消息变体，区分终端消息和外部聊天消息 |
| G32-017 | P3 | `is_connected()` 使用 `try_read()`，锁竞争时返回 false | 改用 `AtomicBool` 存储连接状态，无锁原子读 |

**注意事项：**
- G32-008 新建 migration 命名：`YYYYMMDDHHMMSS_feishu_app_config_unique_app_id.sql`
- G32-015 依赖 Agent 16 完成 G32-017（`is_connected` 改为 AtomicBool），如 Agent 16 未完成可先 stub
- G32-016 需要修改 message_bus 的消息类型枚举，确认 `BusMessage` 定义位置
  - 使用 augment-code MCP 搜索 `BusMessage` 定义，确认是否在 Agent 16/17 独占范围内
  - 如 `BusMessage` 在 `message_bus.rs`（Phase 0 已有 Agent 管理），则仅添加新变体，不修改现有变体
- feishu.rs 是路由处理的核心文件，修改多个函数需逐一验证
- main.rs 修改仅限 `connected` 状态设置位置（1 行），不影响其他启动逻辑
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 18 — Feishu 前端 + i18n 补充

**负责文件（独占）：**
- `frontend/src/pages/settings/FeishuSettings.tsx`
- `frontend/src/components/workflow/PrCommentsDialog.tsx`

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G32-014 | P3 | FeishuSettings.tsx 使用 `lucide-react` 图标 | 迁移为 `@phosphor-icons/react` 等效图标 |
| G32-018 | P3 | 前端保存 Feishu 配置后不触发后端重连 | 保存成功后自动调用 reconnect API（`POST /api/feishu/reconnect`） |
| G34-010 | P3 | PrCommentsDialog 错误消息硬编码英文 | 替换为 `t()` 调用，添加对应 i18n key |
| G34-011 | P3 | PrCommentsDialog 使用 `lucide-react` 图标 | 迁移为 `@phosphor-icons/react` |

**注意事项：**
- FeishuSettings.tsx 的图标迁移与 Phase 1 Agent 15 的 icon 迁移模式相同
- PrCommentsDialog 的 i18n key 添加到已有的翻译文件中（确认 namespace）
- G32-018 的 reconnect 调用需要处理失败场景（toast 通知用户）
- 使用 augment-code MCP 搜索 FeishuSettings 中所有 lucide-react import
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 19 — Task Attempts 前端 + 数据库约束

**负责文件（独占）：**
- `crates/db/migrations/` 下新建 migration 文件（merges unique 约束）
  - 注意：此 migration 是 Phase 0 Agent 7 G34-003 的实际执行，如 Agent 7 已创建则跳过
- `frontend/src/components/workflow/workflowStatus.ts`（状态清理/补充）

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G34-003 | P2 | `merges` 表缺少唯一约束，PR 记录可重复（如 Phase 0 Agent 7 未处理 migration） | 新建 migration 添加 `UNIQUE(task_attempt_id, pr_number)` |
| 状态补充 | P3 | workflowStatus.ts 需与 Phase 0/1 新增的状态值对齐 | 确认所有后端新增状态（paused, merge_partial_failed, cancelled 等）在前端都有对应处理 |

**注意事项：**
- 本 Agent 工作量较小，核心任务是确保 Phase 0 Agent 7 的 migration 已正确创建
- workflowStatus.ts 的修改需参考 Phase 0 Agent 1（新增 paused 状态）和 Agent 2（新增 merge_partial_failed 状态）
- 如 Phase 0 Agent 7 已完成 G34-003 的 migration，本 Agent 仅做验证
- 完成核心任务后可协助其他 Agent 进行代码 review
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 20 — 跨模块集成验证 + 文档同步

**负责文件（独占）：**
- `docs/undeveloped/current/2026-03-14-audit-fix-status.md`（状态更新）
- `docs/undeveloped/current/TODO.md`（进度更新）
- `CLAUDE.md`（G08-004 文档修正，注意：gitignored，仅本地修改）

**任务清单：**

| ID | 类型 | 任务 | 执行方式 |
|----|------|------|----------|
| G08-004 | 修复 | CLAUDE.md 中 broadcast channel 容量描述（32）与实际代码（1000）不符 | 更新 CLAUDE.md 中的描述为 1000 |
| VERIFY-001 | 验证 | 全量 Rust 测试 | `cargo test --workspace` 全部通过 |
| VERIFY-002 | 验证 | 全量前端测试 | `cd frontend && pnpm test:run` 全部通过 |
| VERIFY-003 | 验证 | Clippy 无新 warning | `cargo clippy --workspace -- -D warnings` |
| VERIFY-004 | 验证 | ESLint 无新错误 | `pnpm run frontend:lint` |
| VERIFY-005 | 验证 | TypeScript 编译通过 | `pnpm run frontend:check` |
| VERIFY-006 | 验证 | 类型生成同步 | `pnpm run generate-types:check` |
| VERIFY-007 | 验证 | i18n 检查通过 | `pnpm run frontend:lint:i18n` |
| VERIFY-008 | 验证 | 数据库 migration 正确应用 | `pnpm run prepare-db:check` |
| DOC-001 | 文档 | 更新 audit-fix-status.md | 将所有已修复 G-ID 状态更新为 FIXED |
| DOC-002 | 文档 | 更新 TODO.md | 标记 Phase 0/1/2 为已完成，更新统计数据 |

**注意事项：**
- 本 Agent 的核心价值是确保所有 Phase 的修改集成后系统仍正常工作
- 如发现集成问题（如 Agent 间文件冲突、类型不匹配、测试失败），需定位到具体 Agent 的修改并协调修复
- 验证任务应按顺序执行：先 backend（VERIFY-001/003）→ 再 frontend（VERIFY-002/004/005）→ 最后 cross-cutting（VERIFY-006/007/008）
- 文档更新在所有验证通过后进行
- **必须使用 augment-code MCP 进行文件索引**

---

## Phase 2 完成后的最终检查

Phase 2 所有 5 个 Agent 完成后，执行最终验证：

1. **全量测试通过**：`cargo test --workspace` + `cd frontend && pnpm test:run`
2. **零 lint 错误**：`cargo clippy --workspace` + `pnpm run frontend:lint`
3. **类型同步**：`pnpm run generate-types:check`
4. **DB schema 正确**：`pnpm run prepare-db:check`
5. **前端构建成功**：`cd frontend && pnpm build`
6. **后端构建成功**：`cargo build --release -p server`
7. **Chrome DevTools MCP 端到端测试**：
   - 创建 workflow → prepare → start → 观察终端执行
   - WS 断开/重连后事件恢复
   - Feishu 配置保存 → 自动重连
   - Debug 页面终端切换无泄漏
8. **CI 全绿**：推送后确认 ci-basic + ci-quality + ci-docker 全部通过

---

## 全局协调规则

### 文件独占矩阵

以下文件在多个 Phase 中被不同 Agent 修改，通过修改区域隔离避免冲突：

| 文件 | Phase 0 Agent | Phase 1 Agent | Phase 2 Agent | 隔离策略 |
|------|---------------|---------------|---------------|----------|
| `agent.rs` | Agent 1（pause/stop/recovery）, Agent 2（merge/quality/provider） | — | — | 函数级隔离，不交叉 |
| `workflows.rs` | Agent 1（pause/stop 端点）, Agent 2（merge 端点）, Agent 5（worktree 路径） | — | — | 行号区域隔离 |
| `Board.tsx` | — | Agent 14（quality handler） | — | 单函数修改 |
| `wsStore.ts` | — | Agent 11（全量负责） | — | 独占 |
| `WorkflowWizard.tsx` | — | Agent 13（handleNext） | — | 单函数修改 |
| Wizard Step*.tsx | — | Agent 13（validators 引用的 types）, Agent 15（icon import） | — | 不同修改区域 |
| `subscription_hub.rs` | Agent 6（pending_events TTL） | — | — | 已有逻辑不动，仅添加 TTL |

### 跨 Phase 依赖

| 依赖方 | 被依赖方 | 说明 |
|--------|----------|------|
| Phase 1 Agent 11 (G31-002) | Phase 0 Agent 2 (G31-002 backend) | wsStore 前端类型需匹配后端 payload |
| Phase 1 Agent 9 (G26-007) | Phase 0 Agent 2 (merge progress events) | Workflows.tsx 订阅的事件需后端先发 |
| Phase 1 Agent 12 (G28-003) | Phase 0 Agent 4 (terminal WS) | Debug 页面 WS 订阅需后端 WS 稳定 |
| Phase 2 Agent 17 (G32-015) | Phase 2 Agent 16 (G32-017) | Health 查询依赖 AtomicBool 连接状态 |
| Phase 2 Agent 19 (状态补充) | Phase 0 Agent 1/2 (新状态) | 前端状态需匹配后端新增状态 |

### augment-code MCP 使用规范

所有 20 个 Agent 在以下场景**必须**使用 augment-code MCP：

1. **查找文件位置**：不确定文件路径时
2. **搜索引用**：修改函数/类型/常量前搜索所有引用点
3. **确认 import 关系**：修改导出时确认下游依赖
4. **验证修改完整性**：修改后搜索确认无遗漏

禁止使用其他文件搜索方式（如 `find`, `grep` 命令）替代 augment-code MCP。
