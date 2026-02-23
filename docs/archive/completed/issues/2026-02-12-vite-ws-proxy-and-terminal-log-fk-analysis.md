# 2026-02-12 Vite WS 代理报错与 Terminal Log FK 报错联合问题记录

## 背景
本地开发环境出现两类高频错误：

1. 前端 Vite 代理相关：
- `ws proxy socket error: write ECONNABORTED`
- `ws proxy error: read ECONNRESET`

2. 后端终端日志落库相关：
- `Failed to persist terminal logs in flush task`
- `error returned from database: (code: 787) FOREIGN KEY constraint failed`

## 2026-02-13 二次深挖范围与约束
- 调查方式：8 个 sub-agent 并行做代码审计（前端 WS、后端 WS、terminal logger、workflow 删除链路、DB 约束链路、错误放大机制、跨模块交互）。
- 证据范围：仅仓库真实代码与日志引用，不使用假设场景。
- 目标：深挖已知问题，补充新增已证实问题。

## 已知问题深挖（全部可由代码直接验证）

### 1) WS 断开类错误的完整代码路径
- Vite `/api` 代理显式开启 `ws: true`，WS 流量经过 dev server 代理层：`frontend/vite.config.ts:82`、`frontend/vite.config.ts:86`
- Workflow Debug 使用 `/api` 构造 WS 入口并传给 terminal 组件：`frontend/src/pages/WorkflowDebug.tsx:49`、`frontend/src/pages/WorkflowDebug.tsx:53`
- `TerminalEmulator` 在 `ws.onerror/ws.onclose` 中统一标记断开并上抛错误：`frontend/src/components/terminal/TerminalEmulator.tsx:216`、`frontend/src/components/terminal/TerminalEmulator.tsx:241`
- 后端 `terminal_ws` 存在固定心跳与空闲超时（30s / 300s）并在超时时退出：`crates/server/src/routes/terminal_ws.rs:35`、`crates/server/src/routes/terminal_ws.rs:321`
- 后端在 terminal 未运行、无法取得 writer、无法订阅输出时会发送错误并主动关闭 WS：`crates/server/src/routes/terminal_ws.rs:133`、`crates/server/src/routes/terminal_ws.rs:163`、`crates/server/src/routes/terminal_ws.rs:183`

### 2) FK 787 刷屏的完整代码路径
- flush 任务是 `tokio::spawn + loop + interval.tick()` 的周期任务，失败后仅记录错误，不退出循环：`crates/services/src/services/terminal/process.rs:1338`、`crates/services/src/services/terminal/process.rs:1358`
- `flush_buffer` 只有在写库成功时才清空 buffer，失败时保留原数据用于下一轮重试：`crates/services/src/services/terminal/process.rs:1327`、`crates/services/src/services/terminal/process.rs:1329`
- 实际写库逐条执行 `TerminalLog::create`：`crates/services/src/services/terminal/process.rs:1290`
- `terminal_log.terminal_id` 外键指向 `terminal.id` 且 `ON DELETE CASCADE`，terminal 行缺失时插入必然 FK 失败：`crates/db/migrations/20260117000001_create_workflow_tables.sql:236`
- 删除链路为 `workflow -> workflow_task -> terminal -> terminal_log` 级联：`crates/db/migrations/20260117000001_create_workflow_tables.sql:159`、`crates/db/migrations/20260117000001_create_workflow_tables.sql:189`、`crates/db/migrations/20260117000001_create_workflow_tables.sql:236`

## 新增已证实问题（本次挖掘新增）

### A) flush worker 生命周期未被 `TrackedProcess` 管控
- `TrackedProcess` 仅保存 `logger_task` 和 `logger_shutdown_tx`，未保存 flush worker 的句柄：`crates/services/src/services/terminal/process.rs:205`、`crates/services/src/services/terminal/process.rs:223`
- `stop_logger_task_gracefully` 只等待 `logger_task`，不会等待/终止 flush worker：`crates/services/src/services/terminal/process.rs:366`
- 结果：即使 logger 主任务退出，flush worker 仍可能继续周期写库并持续报 FK 787。

### B) `delete_workflow` 与 `stop_workflow` 清理语义不一致
- `delete_workflow` 直接执行 `Workflow::delete`，没有调用 terminal kill / watcher unregister 等流程：`crates/server/src/routes/workflows.rs:713`、`crates/db/src/models/workflow.rs:678`
- `stop_workflow` 明确包含 `kill_terminal`、`prompt_watcher.unregister` 等停止清理动作：`crates/server/src/routes/workflows.rs:1278`、`crates/server/src/routes/workflows.rs:1339`
- 结果：删除路径会先删 DB 记录（含 terminal 级联），但没有复用停止流程的运行态清理步骤。

### C) 前端自动恢复只覆盖一种错误文案
- `TerminalDebugView` 的自动恢复只在 `error.message` 包含 `Terminal process not running` 时触发：`frontend/src/components/terminal/TerminalDebugView.tsx:231`
- `TerminalEmulator` 在 `ws.onerror/ws.onclose` 上抛的是 `Terminal WebSocket error` 或断开提示：`frontend/src/components/terminal/TerminalEmulator.tsx:216`、`frontend/src/components/terminal/TerminalEmulator.tsx:232`
- 结果：网络断链类错误不会进入该自动恢复分支。

### D) “terminal 进程句柄缺失”会形成稳定的 WS 失败闭环
- `ProcessManager::get_handle` 返回 `None` 时，`terminal_ws` 会返回 `Terminal process not running` 并关闭连接：`crates/services/src/services/terminal/process.rs:981`、`crates/server/src/routes/terminal_ws.rs:114`
- 这一路径只发错误并关闭 WS，不会在该处理器内更新 terminal 记录状态：`crates/server/src/routes/terminal_ws.rs:114`、`crates/server/src/routes/terminal_ws.rs:147`

### E) 已存在错误放大器（高频日志放大）
- 前端 `wsStore` 在 `onmessage` 处理里对解析错误和 handler 错误直接 `console.error`，会按消息频率重复打印：`frontend/src/stores/wsStore.ts:931`、`frontend/src/stores/wsStore.ts:944`、`frontend/src/stores/wsStore.ts:952`
- 后端 flush 失败每个 interval tick 都会重复 `tracing::error`：`crates/services/src/services/terminal/process.rs:1338`、`crates/services/src/services/terminal/process.rs:1358`

## 结论（更新）
- 原结论“两个独立问题叠加”仍成立，但代码审计后可进一步确定是“多处生命周期不一致 + 错误放大机制”共同导致终端日志高噪声。
- 当前最关键的可证实链路是：
1. WS 链路存在服务端主动关闭与空闲超时路径（可解释 `ECONNABORTED/ECONNRESET` 噪声）。
2. workflow 级联删除可使 terminal 行消失。
3. flush 任务失败不退出且失败数据不清空，导致 FK 787 持续重试。
4. flush worker 未纳入 `TrackedProcess` 停止管理，放大持续报错概率。

## 2026-02-14 补充：ECONNABORTED 根因收敛与落地修复

### 新增已证实结论（仅基于真实代码）
1. 前端存在“终端未 ready 即提前创建 WS”的时序窗口。  
`TerminalDebugView` 在 `starting/waiting` 状态也会渲染 live terminal，触发 `TerminalEmulator` 立即执行 `new WebSocket(...)`。在 `start` 请求尚未完成、后端还未稳定可接入时，这个提前连接会落在 Vite `/api` WS 代理层并报 `write ECONNABORTED`。  
证据：`frontend/src/components/terminal/TerminalDebugView.tsx:75`、`frontend/src/components/terminal/TerminalDebugView.tsx:398`、`frontend/src/components/terminal/TerminalEmulator.tsx:224`。

2. 后端确实存在主动关闭 WS 的硬路径（该点是“现象可解释链路”，不是本次主修复点）。  
当 `get_handle` 为空、`writer` 不可用、`subscribe_output` 失败时，`terminal_ws` 会发送 error 并立即 close。  
证据：`crates/server/src/routes/terminal_ws.rs:123`、`crates/server/src/routes/terminal_ws.rs:156`、`crates/server/src/routes/terminal_ws.rs:169`。

3. workflow 停止/删除生命周期清理链路本身是统一的。  
`stop_workflow` 与 `delete_workflow` 都会进入 terminal 清理（kill PTY + unregister watcher），因此“清理遗漏导致 WS 长期残留”不是本次主因。  
证据：`crates/server/src/routes/workflows.rs:725`、`crates/server/src/routes/workflows.rs:1313`、`crates/server/src/routes/workflows.rs:1363`。

### 本次修复（最小改动）
1. 收紧 live terminal 渲染门槛，避免 start 进行中或 `starting/waiting` 早连 WS。  
- 新增：`startingTerminalIdsRef` 命中时强制不渲染 `TerminalEmulator`。  
- 调整：fallback 可直连状态从 `starting/waiting/working/running/active` 收敛为 `working/running/active`。  
变更：`frontend/src/components/terminal/TerminalDebugView.tsx`。

2. 新增回归测试，锁定“未 ready 不建 WS、ready 后才建 WS”行为。  
变更：`frontend/src/components/terminal/TerminalDebugView.test.tsx`。

3. 后端 WS 断连日志降噪（非功能修复）：将常见连接中断类错误降级为 debug，避免误导排查。  
变更：`crates/server/src/routes/terminal_ws.rs`。

### 验证结果
1. 前端定向测试通过：  
`npm --prefix frontend run test:run -- src/components/terminal/TerminalDebugView.test.tsx`  
结果：`17 passed`。

2. 后端编译检查通过：  
`cargo check -p server --bin server`  
结果：通过（仅有仓库既有 warnings）。

## 2026-02-22 补充：/board WS 噪声根因与修复策略（本轮）

### 已证实根因（仅代码证据）
1. `/board` 在选中 workflow 后会建立 workflow-scoped WS 连接。
- `Board` 调用 `useWorkflowEvents(selectedWorkflowId, workflowEventHandlers)`：`frontend/src/pages/Board.tsx:35`
- WS URL 固定为 `/api/ws/workflow/{id}/events`：`frontend/src/stores/wsStore.ts:563`、`frontend/src/stores/wsStore.ts:566`
- Vite `/api` 代理开启 `ws: true`：`frontend/vite.config.ts:82`、`frontend/vite.config.ts:86`

2. `useWorkflowEvents` 的订阅 effect 显式依赖 `handlers` 引用；引用变化会触发一次“清理 + 重新订阅”。
- 依赖数组包含 `handlers`：`frontend/src/stores/wsStore.ts:1541`
- effect 内按事件类型逐个 `subscribeToWorkflow`：`frontend/src/stores/wsStore.ts:1458`、`frontend/src/stores/wsStore.ts:1530`
- cleanup 会逐个 `unsub`：`frontend/src/stores/wsStore.ts:1538`、`frontend/src/stores/wsStore.ts:1539`

3. 本轮修复点与上述机制一一对应：`Board` 将 WS handlers 稳定化为 `useCallback + useMemo`，以避免渲染期订阅抖动。
- 稳定化回调：`frontend/src/pages/Board.tsx:17`
- 稳定化 handlers 对象：`frontend/src/pages/Board.tsx:24`
- 将稳定引用传入 hook：`frontend/src/pages/Board.tsx:35`

### 本轮修复策略（已落地）
1. 在 `/board` 页面固定 WS handlers 引用，降低订阅抖动导致的噪声。
- 代码：`frontend/src/pages/Board.tsx:1`、`frontend/src/pages/Board.tsx:24`、`frontend/src/pages/Board.tsx:35`

2. 增加页面级回归测试，覆盖 `useWorkflowEvents` 入参与 workflow 选择时序，防止回退到抖动模式。
- 测试用例：`frontend/src/pages/Board.test.tsx:74`
- 关键断言（先 `null`，后 `wf-selected`）：`frontend/src/pages/Board.test.tsx:80`、`frontend/src/pages/Board.test.tsx:103`

### 噪声放大点（当前代码已证实）
- 前端 WS handler/解析异常会直接 `console.error`，会按消息频率放大日志：`frontend/src/stores/wsStore.ts:931`、`frontend/src/stores/wsStore.ts:944`、`frontend/src/stores/wsStore.ts:952`
- WS transport error 也直接 `console.error`：`frontend/src/stores/wsStore.ts:1102`

## 2026-02-22 补充（二）：JSON Patch WS 清理时序根因与修复策略（本轮新增）

### 已证实根因（仅代码证据）
1. `useJsonPatchWsStream` 的 `onclose` 分支会对“非 finished 且非 clean close”执行重连调度。  
- 证据：`frontend/src/hooks/useJsonPatchWsStream.ts:185`、`frontend/src/hooks/useJsonPatchWsStream.ts:190`、`frontend/src/hooks/useJsonPatchWsStream.ts:195`

2. 同一个 hook 在“禁用/无 endpoint”与“effect cleanup”两条路径都会执行 socket 清理；该清理如果不与 `onclose` 重连逻辑隔离，会把主动清理误判为异常断连。  
- 证据：`frontend/src/hooks/useJsonPatchWsStream.ts:88`、`frontend/src/hooks/useJsonPatchWsStream.ts:91`、`frontend/src/hooks/useJsonPatchWsStream.ts:202`、`frontend/src/hooks/useJsonPatchWsStream.ts:203`

3. 该 hook 明确考虑了 StrictMode/dev 双挂载下 cleanup 发生在 `CONNECTING` 的场景，说明“连接尚未完成时的清理时序”是实际处理对象。  
- 证据：`frontend/src/hooks/useJsonPatchWsStream.ts:70`、`frontend/src/hooks/useJsonPatchWsStream.ts:72`

### 本轮修复动作（已落地）
1. 新增统一清理函数 `teardownSocket`，先解绑所有事件处理器，阻断 cleanup 触发重连回路。  
- 动作与证据：`frontend/src/hooks/useJsonPatchWsStream.ts:63`、`frontend/src/hooks/useJsonPatchWsStream.ts:64`、`frontend/src/hooks/useJsonPatchWsStream.ts:68`

2. 对 `CONNECTING` 态改为“等 `open` 后再 `close(1000, 'cleanup')`”，避免连接未建立即关闭带来的浏览器告警与额外噪声。  
- 动作与证据：`frontend/src/hooks/useJsonPatchWsStream.ts:72`、`frontend/src/hooks/useJsonPatchWsStream.ts:74`、`frontend/src/hooks/useJsonPatchWsStream.ts:76`

3. 将两条清理入口统一切换为 `teardownSocket`，替换直接 `ws.close()`，减少重复回连抖动。  
- 动作与证据：`frontend/src/hooks/useJsonPatchWsStream.ts:91`、`frontend/src/hooks/useJsonPatchWsStream.ts:92`、`frontend/src/hooks/useJsonPatchWsStream.ts:203`、`frontend/src/hooks/useJsonPatchWsStream.ts:204`

4. 修复影响面覆盖所有复用该 hook 的 WS 流页面，不局限于单一页面。  
- 证据：`frontend/src/hooks/useProjects.ts:23`、`frontend/src/hooks/useProjectTasks.ts:55`、`frontend/src/hooks/useExecutionProcesses.ts:48`、`frontend/src/components/ui-new/hooks/useWorkspaces.ts:134`

### 验证建议（面向回归）
1. 在 React StrictMode 的 dev 环境反复挂载/卸载使用该 hook 的页面（projects/tasks/workspaces），确认不会出现 cleanup 触发的重连风暴。  
- 重点观察：浏览器 Network 中同一 stream endpoint 不应短时间内持续新建 WS。

2. 重点检查浏览器控制台不再出现“连接建立前关闭”类告警，并确认异常断连时仍保留 backoff 重连能力（非 clean close 才重连）。  
- 关联逻辑：`frontend/src/hooks/useJsonPatchWsStream.ts:72`、`frontend/src/hooks/useJsonPatchWsStream.ts:190`、`frontend/src/hooks/useJsonPatchWsStream.ts:195`

3. 维持页面级自动化回归，避免 `/board` 侧修复回退。  
- 现有用例：`frontend/src/pages/Board.test.tsx:74`
- 建议命令：`npm --prefix frontend run test:run -- src/pages/Board.test.tsx`
