# Codex 项目完整分析（多 Agent 全量审计）

> 生成时间：2026-02-07  
> 审计方式：Sub-agents 并行代码审计（不改代码）  
> 审计目标：只识别**直接 Bug**与**逻辑问题（代码不报错但功能无法实现/行为错误）**  
> 说明：按你的要求，本报告**不包含修复方案**，仅给出问题与成因。

---

## 一、总评（100 分制）

- **项目综合评分：73 / 100**

### 评分维度

| 维度 | 权重 | 得分 | 说明 |
|---|---:|---:|---|
| 功能正确性 | 40 | 27 | 主链路可运行，但存在跨端契约断点与事件丢失 |
| 架构一致性 | 20 | 14 | 前后端 DTO / WS payload 不一致较多 |
| 错误语义与可观测性 | 15 | 10 | 大量业务错误仍返回 200，部分状态更新无 WS 广播 |
| 安全边界 | 15 | 11 | 存在路径边界与命令拼接风险 |
| 回归测试可兜底能力 | 10 | 11 | 核心链路有测试，但对“静默失败”覆盖不足 |

---

## 二、Sub-agents 分工与回收情况

本轮共创建 **24 个 Agent**：
- 前端工程师：**5**（FE-1 ~ FE-5）
- 后端工程师：**8**（BE-1 ~ BE-8）
- 全栈工程师：**10**（FS-1 ~ FS-10）
- 组合链路全栈工程师：**1**（FS-X）

### Agent 覆盖矩阵（摘要）

| Agent | 方向 | 主要覆盖 | 原始发现数 |
|---|---|---|---:|
| FE-1 | 前端 | workflow 组件/Workflows 页面 | 4 |
| FE-2 | 前端 | wsStore/ExecutionProcesses/TerminalDebug | 3 |
| FE-3 | 前端 | tasks 组件与任务行为 | 6 |
| FE-4 | 前端 | settings/api/shared 契约 | 5 |
| FE-5 | 前端 | ui-new/panel/slash command | 5 |
| BE-1 | 后端 | workflows/task_attempts/terminals/ws | 5 |
| BE-2 | 后端 | projects/repo/config/slash/tasks | 4 |
| BE-3 | 后端 | terminal launcher/process/prompt watcher | 8 |
| BE-4 | 后端 | orchestrator 运行态与状态机 | 6 |
| BE-5 | 后端 | DB models/migrations/.sqlx | 7 |
| BE-6 | 后端 | executors/command/log processor | 5 |
| BE-7 | 后端 | review/cc-switch/utils | 5 |
| BE-8 | 后端 | deployment/main/auth/mcp task server | 5 |
| FS-1 | 全栈 | workflow 主链路端到端 | 5 |
| FS-2 | 全栈 | open editor/remote capability 契约 | 4 |
| FS-3 | 全栈 | WS 事件语义与前端消费 | 4 |
| FS-4 | 全栈 | 任务详情/缓存键一致性 | 4 |
| FS-5 | 全栈 | auto_confirm/prompt 决策链 | 6 |
| FS-6 | 全栈 | 错误码语义与前端感知 | 8 |
| FS-7 | 全栈 | 多仓合并/workspace 链路 | 7 |
| FS-8 | 全栈 | 安全边界（路径/命令） | 3 |
| FS-9 | 全栈 | 并发竞态/性能退化 | 5 |
| FS-10 | 全栈 | 测试缺口与静默失败点 | 5 |
| FS-X | 组合 | 跨模块组合链路 | 7 |

> 原始发现去重后，形成下述“问题清单”。

---

## 三、去重后的问题清单（直接 Bug + 逻辑问题）

## P0（高优先，直接影响核心功能）

### P0-01 终端 Prompt 检测正则存在运行时 panic 风险（DirectBug）
- **原因**：`SELECT_MARKER_RE` / `SELECTED_MARKER_RE` 正则表达式模式异常，首次触发时可能 panic。
- **证据**：`crates/services/src/services/terminal/prompt_detector.rs:155`、`crates/services/src/services/terminal/prompt_detector.rs:162`

### P0-02 `auto_confirm=false` 时 PromptWatcher 被禁用，手动确认链路断裂（Logic）
- **原因**：注册逻辑直接 `unregister`，导致本应“AskUser”的路径无法检测 prompt。
- **证据**：`crates/services/src/services/terminal/prompt_watcher.rs:181`、`crates/services/src/services/orchestrator/prompt_handler.rs:182`

### P0-03 `terminal.completed` WS payload 与前端类型不一致（DirectBug）
- **原因**：后端直接序列化 `TerminalCompletionEvent`（snake_case + review_* 状态），前端按 camelCase 且仅 `completed/failed/cancelled` 解码。
- **证据**：`crates/server/src/routes/workflow_events.rs:176`、`frontend/src/stores/wsStore.ts:754`

### P0-04 `terminal.prompt_detected` payload 与前端消费契约不一致（DirectBug）
- **原因**：后端发送 `options` 对象数组与 Debug 格式 `promptKind`，前端期望 `string[]` 与稳定枚举字符串。
- **证据**：`crates/server/src/routes/workflow_events.rs:222`、`crates/server/src/routes/workflow_events.rs:226`、`frontend/src/stores/wsStore.ts:773`

### P0-05 `terminal.prompt_decision` payload 类型不一致（DirectBug）
- **原因**：后端发送结构化 `PromptDecision` 对象，前端类型定义为 `decision: string`。
- **证据**：`crates/server/src/routes/workflow_events.rs:243`、`frontend/src/stores/wsStore.ts:784`

### P0-06 状态更新“发布通道”与 EventBridge 监听通道不一致（Logic）
- **原因**：大量状态更新仅 `publish(topic)`，EventBridge 仅 `subscribe_broadcast()`，导致 WS 端收不到关键状态。
- **证据**：`crates/services/src/services/orchestrator/agent.rs:1081`、`crates/server/src/routes/event_bridge.rs:51`、`crates/services/src/services/orchestrator/message_bus.rs:127`

### P0-07 `merge_workflow` 状态校验自相矛盾（Logic）
- **原因**：入口允许 `starting/running`，随后又要求所有 task `completed`，造成可进入但随即冲突。
- **证据**：`crates/server/src/routes/workflows.rs:1321`、`crates/server/src/routes/workflows.rs:1361`

### P0-08 任务终端列表接口忽略 `workflow_id` 作用域（Logic）
- **原因**：路径参数中的 `workflow_id` 被丢弃，仅按 `task_id` 查询。
- **证据**：`crates/server/src/routes/workflows.rs:1293`、`crates/server/src/routes/workflows.rs:1295`

### P0-09 `update_workflow_status` 无状态机校验（Logic）
- **原因**：任意字符串状态可写入，破坏流程状态机一致性。
- **证据**：`crates/server/src/routes/workflows.rs:650`、`crates/server/src/routes/workflows.rs:655`

### P0-10 `/git/status` 与 `/git/init` 缺少路径边界限制（DirectBug）
- **原因**：直接使用请求中的路径执行 Git 操作，未限制在项目允许目录。
- **证据**：`crates/server/src/routes/git.rs:32`、`crates/server/src/routes/git.rs:74`

### P0-11 Codex setup 脚本存在未转义拼接（DirectBug）
- **原因**：`program + args.join(" ")` 直接拼接成 Bash 脚本字符串。
- **证据**：`crates/server/src/routes/task_attempts/codex_setup.rs:89`

### P0-12 Open Editor 对“目录路径”误判为“文件路径”（Logic）
- **原因**：只要传了 `file_path` 就设置 `is_file_hint=true`，远程 URL 追加 `:1:1`。
- **证据**：`crates/server/src/routes/projects.rs:511`、`crates/server/src/routes/repo.rs:182`、`crates/services/src/services/config/editor/mod.rs:192`

### P0-13 MCP TaskServer 在开启 API Token 场景下可能全量失效（DirectBug）
- **原因**：内部 reqwest 请求未携带鉴权头；若服务开启 token，会收到 401。
- **证据**：`crates/server/src/mcp/task_server.rs:288`、`crates/server/src/mcp/task_server.rs:391`、`crates/server/src/middleware/auth.rs:53`

### P0-14 Orchestrator `start_workflow` 存在并发重复启动窗口（Logic）
- **原因**：运行中检查与插入 running map 中间有多次 `await`，并发请求可双启动。
- **证据**：`crates/services/src/services/orchestrator/runtime.rs:231`、`crates/services/src/services/orchestrator/runtime.rs:316`

## P1（中优先，影响稳定性与用户体验）

### P1-01 `stop_all` 仅 kill PID，未走完整终端清理链（Logic）
- **原因**：调用 `process_manager.kill(pid)`，未执行 `kill_terminal` 的跟踪清理逻辑。
- **证据**：`crates/services/src/services/terminal/launcher.rs:676`

### P1-02 `kill_terminal` 先移除跟踪再 kill，且 kill 失败仍返回成功（DirectBug）
- **原因**：从 map 移除后 kill 失败仅 warn，不回滚状态。
- **证据**：`crates/services/src/services/terminal/process.rs:802`、`crates/services/src/services/terminal/process.rs:817`

### P1-03 终端停止时 logger task 直接 abort，存在日志尾部丢失（DirectBug）
- **原因**：未做最终 flush。
- **证据**：`crates/services/src/services/terminal/process.rs:811`、`crates/services/src/services/terminal/process.rs:1251`

### P1-04 `get_handle` 每次生成新 session_id，易与已有绑定错位（Logic）
- **原因**：重连时会话标识不稳定，可能影响 watcher/session 对齐。
- **证据**：`crates/services/src/services/terminal/process.rs:909`

### P1-05 `wsStore.send()` 回退到“第一个开放连接”，多 workflow 可能串发（DirectBug）
- **原因**：未按 workflow 维度路由发送。
- **证据**：`frontend/src/stores/wsStore.ts:667`、`frontend/src/stores/wsStore.ts:676`

### P1-06 WorkflowDebug 固定 `ws://`，HTTPS 下会混合内容失败（DirectBug）
- **原因**：协议未按页面上下文切换 `wss://`。
- **证据**：`frontend/src/pages/WorkflowDebug.tsx:95`

### P1-07 `TaskCard` 跳父任务成功后未重置 `isNavigatingToParent`（Logic）
- **原因**：只在 catch 里 reset，成功分支不 reset。
- **证据**：`frontend/src/components/tasks/TaskCard.tsx:55`、`frontend/src/components/tasks/TaskCard.tsx:67`

### P1-08 `createAndStart` / `shareTask` 缓存失效不完整（Logic）
- **原因**：未同步失效 workspace summary / 任务相关 key，导致 UI 陈旧。
- **证据**：`frontend/src/hooks/useTaskMutations.ts:49`、`frontend/src/hooks/useTaskMutations.ts:101`

### P1-09 MCP 配置保存对“空内容”直接 no-op（Logic）
- **原因**：`if (mcpServers.trim())` 才保存，无法清空配置。
- **证据**：`frontend/src/pages/settings/McpSettings.tsx:167`

### P1-10 前端 Result 处理在非 2xx 时丢弃结构化错误（Logic）
- **原因**：`handleApiResponseAsResult` 对非 2xx 强制 `error: undefined`。
- **证据**：`frontend/src/lib/api.ts:149`、`frontend/src/lib/api.ts:164`

### P1-11 错误语义不一致：大量业务失败返回 HTTP 200（Logic）
- **原因**：`ApiResponse::error/error_with_data` 被直接包在 200 响应中。
- **证据**：`crates/server/src/routes/task_attempts.rs:588`、`crates/server/src/routes/task_attempts.rs:1330`、`crates/server/src/routes/config.rs:257`

### P1-12 错误映射偏差：NotFound/Validation 被映射为 400 或 500（Logic）
- **原因**：`ApiError` 与 `From<...>` 规则过于粗糙。
- **证据**：`crates/server/src/error.rs:96`、`crates/server/src/error.rs:211`、`crates/server/src/error.rs:251`

### P1-13 `search_repo` 将所有 repo 获取错误都映射为 404（Logic）
- **原因**：错误分支统一 `return Err(StatusCode::NOT_FOUND)`。
- **证据**：`crates/server/src/routes/repo.rs:233`、`crates/server/src/routes/repo.rs:235`

### P1-14 `set_mcp_servers_in_config_path` 在空 path 场景可 panic（DirectBug）
- **原因**：`path[..path.len()-1]` 与 `path.last().unwrap()` 无空保护。
- **证据**：`crates/server/src/routes/config.rs:381`、`crates/server/src/routes/config.rs:395`

### P1-15 任务/工作区运行状态查询未统一排除 `dropped` 进程（Logic）
- **原因**：SQL 条件只看 `ep.status/run_reason`，未过滤 `ep.dropped`。
- **证据**：`crates/db/src/models/task.rs:158`、`crates/db/src/models/workspace.rs:582`、`crates/db/src/models/workspace.rs:687`

## P2（低到中优先，影响长期一致性）

### P2-01 迁移脚本重建 terminal 表时丢失 `vk_session_id` 外键（Logic）
- **原因**：新表定义未保留 `REFERENCES sessions(id)` 约束。
- **证据**：`crates/db/migrations/20260117000001_create_workflow_tables.sql:213`、`crates/db/migrations/20260208010000_backfill_terminal_auto_confirm.sql:28`

### P2-02 命令构造 `simple_join + split` 会破坏带空格/引号参数（DirectBug）
- **原因**：参数边界在字符串拼接后丢失。
- **证据**：`crates/executors/src/command.rs:120`

### P2-03 `plain_text_processor` 分割边界存在语义风险（Logic）
- **原因**：`Split(line_idx)` 直接 `drain_lines(line_idx)`，`line_idx==0` 时可能反复空转。
- **证据**：`crates/executors/src/logs/plain_text_processor.rs:250`、`crates/executors/src/logs/plain_text_processor.rs:251`

### P2-04 Workflow 页面状态展示逻辑不一致（Logic）
- **原因**：`cancelled -> failed` 映射、徽章对 `created/ready/paused/cancelled` 无样式、停止确认使用删除文案。
- **证据**：`frontend/src/pages/Workflows.tsx:75`、`frontend/src/pages/Workflows.tsx:400`、`frontend/src/pages/Workflows.tsx:235`

### P2-05 远程项目 UI 能力与后端实现不一致（Logic）
- **原因**：前端入口可触发，后端接口固定返回“不支持”。
- **证据**：`frontend/src/pages/settings/OrganizationSettings.tsx:244`、`crates/server/src/routes/projects.rs:111`

### P2-06 Workflow Merge 后端已提供接口，前端主视图未形成闭环操作（Logic）
- **原因**：后端有 `/merge`，但 workflow 主页面未提供同层级 merge 操作入口。
- **证据**：`crates/server/src/routes/workflows.rs:1299`、`frontend/src/hooks/useWorkflows.ts:148`、`frontend/src/pages/Workflows.tsx:270`

---

## 四、审计结论摘要

- 当前项目在“可运行”层面已具备较完整功能，但在以下三点存在系统性短板：
  1. **跨端契约一致性不足**（HTTP/WS payload、类型定义与实际值不一致）
  2. **事件可观测链路不完整**（publish 与 broadcast 通道割裂）
  3. **边界与兜底策略不足**（路径边界、命令拼接、错误语义）

- 对“代码不报错但功能不可用”的影响最直接的区域：
  - Prompt 自动确认链路
  - Workflow 状态广播链路
  - Open Editor 与多仓库/远程项目契约
  - 多 workflow 并发 WS 与发送路由

---

## 五、最终分数说明

- **最终评分：73 / 100**
- 评分含义：
  - 80+：核心链路与契约稳定
  - 70~79：核心可用，但存在多处可触发逻辑缺陷
  - 60~69：高频功能不稳定，需优先修复结构性问题

当前项目处于 **“可用但存在明显结构性逻辑风险”** 区间。

