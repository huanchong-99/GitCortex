# 2026-02-11 终端状态回退与“执行中”残留问题（3 Agents × 10 轮实锤深挖）

## 0) 任务约束（本次严格遵守）

- 不做任何修复，仅做问题探寻与归档。
- 仅记录**代码中可证明**的问题；禁止假设。
- 使用 sub-agent 并行分析：每个 agent 跑满 10 轮（共 30 轮）。
- 对每个结论给出代码证据（`file:line`）。

---

## 1) 分析范围与分工

- Agent-A（后端状态流 / 编排 / 事件总线）
  - `crates/services/src/services/orchestrator/*`
  - `crates/services/src/services/git_watcher.rs`
  - `crates/services/src/services/terminal/*`
  - `crates/services/src/services/orchestrator/message_bus.rs`
  - `crates/server/src/routes/workflow_events.rs`
- Agent-B（前端展示与交互）
  - `frontend/src/pages/WorkflowDebug.tsx`
  - `frontend/src/components/terminal/TerminalDebugView.tsx`
  - `frontend/src/stores/wsStore.ts`
  - `frontend/src/pages/Workflows.tsx`
- Agent-C（前后端契约 / CLI 路径差异）
  - `crates/server/src/routes/terminals.rs`
  - `crates/server/src/routes/terminal_ws.rs`
  - `crates/server/src/routes/workflow_events.rs`
  - `frontend/src/stores/wsStore.ts`
  - `frontend/src/components/workflow/TerminalCard.tsx`

---

## 2) 10 轮记录（按 Agent）

### 2.1 Agent-A（后端）Round1..Round10

1. Round1：发现 `launch_terminal` 成功启动后无状态保护写 `waiting` + 广播，若被误触发可让已完成终端回退。
   - `crates/services/src/services/terminal/launcher.rs:334`
   - `crates/services/src/services/terminal/launcher.rs:342`
2. Round2：完成事件“序号不匹配”直接忽略。
   - `crates/services/src/services/orchestrator/agent.rs:216`
   - `crates/services/src/services/orchestrator/agent.rs:217`
3. Round3：成功完成事件要求 terminal 当前状态必须是 `working`，否则忽略。
   - `crates/services/src/services/orchestrator/agent.rs:251`
4. Round4：CAS 失败直接返回，不更新任务/工作流。
   - `crates/services/src/services/orchestrator/agent.rs:291`
   - `crates/services/src/services/orchestrator/agent.rs:375`
5. Round5：`completed + next_action=continue/retry` 跳过 handoff（非 completion）。
   - `crates/services/src/services/orchestrator/agent.rs:777`
   - `crates/services/src/services/orchestrator/agent.rs:831`
6. Round6：消息总线无订阅者会丢消息。
   - `crates/services/src/services/orchestrator/message_bus.rs:164`
   - `crates/services/src/services/orchestrator/message_bus.rs:201`
7. Round7：成功完成有 40 秒 quiet window 延迟。
   - `crates/services/src/services/orchestrator/agent.rs:268`
   - `crates/services/src/services/orchestrator/agent.rs:273`
8. Round8：下一终端若已到终态（含 completed）则直接跳过 dispatch。
   - `crates/services/src/services/orchestrator/agent.rs:666`
9. Round9：工作流置 `completed` 在编排器内依赖 `CompleteWorkflow` 指令分支。
   - `crates/services/src/services/orchestrator/agent.rs:1126`
   - `crates/services/src/services/orchestrator/agent.rs:1136`
10. Round10：GitWatcher 绑定 workflow 不匹配时跳过事件发布。
   - `crates/services/src/services/git_watcher.rs:406`

### 2.2 Agent-B（前端）Round1..Round10

1. Round1：`useWorkflowEvents` 的终端/任务事件处理是 invalidate query 链路。
   - `frontend/src/pages/Workflows.tsx:290`
   - `frontend/src/pages/Workflows.tsx:306`
2. Round2：`wsStore` 仅分发 handler，不直接写业务状态缓存。
   - `frontend/src/stores/wsStore.ts:909`
   - `frontend/src/stores/wsStore.ts:918`
3. Round3：仅 `terminal.completed` 有 normalize；`terminal.status_changed` 无 normalize。
   - `frontend/src/stores/wsStore.ts:528`
4. Round4：`WorkflowDebug` 用轮询 + DTO 映射重建终端状态。
   - `frontend/src/pages/WorkflowDebug.tsx:87`
   - `frontend/src/pages/WorkflowDebug.tsx:132`
5. Round5：`mapTerminalStatus` 不做“完成态防倒退”。
   - `frontend/src/pages/WorkflowDebug.tsx:151`
6. Round6：`TerminalDebugView` 点击仅切换选中，不直接改状态。
   - `frontend/src/components/terminal/TerminalDebugView.tsx:193`
7. Round7：自动启动仅针对 `not_started`。
   - `frontend/src/components/terminal/TerminalDebugView.tsx:140`
8. Round8：pipeline 状态仅由 `workflow.status` 决定，不由终端完成数派生。
   - `frontend/src/pages/WorkflowDebug.tsx:172`
9. Round9：列表页依赖缓存与刷新策略（原生不做额外纠偏）。
   - `frontend/src/hooks/useWorkflows.ts:436`
10. Round10：看板侧主要是任务状态，不是终端完成链路核心。
   - `frontend/src/components/board/WorkflowKanbanBoard.tsx:41`

### 2.3 Agent-C（契约/CLI）Round1..Round10

1. Round1：`terminal.completed` 含 camel+snake 双字段。
   - `crates/server/src/routes/workflow_events.rs:249`
2. Round2：`terminal.status_changed` 仅 camel 字段。
   - `crates/server/src/routes/workflow_events.rs:217`
3. Round3：前端只对 `terminal.completed` 规范化。
   - `frontend/src/stores/wsStore.ts:528`
4. Round4：`TerminalCompletedStatus` 使用 `review_pass/review_reject`。
   - `frontend/src/stores/wsStore.ts:1319`
5. Round5：`TerminalCard` 使用 `review_passed/review_rejected`。
   - `frontend/src/components/workflow/TerminalCard.tsx:15`
6. Round6：成功完成要求 terminal 当前为 `working`。
   - `crates/services/src/services/orchestrator/agent.rs:251`
7. Round7：dispatch 使用 `waiting -> working` CAS。
   - `crates/services/src/services/orchestrator/agent.rs:1266`
8. Round8：terminal 启动后写 `waiting` 并广播。
   - `crates/services/src/services/terminal/launcher.rs:334`
9. Round9：`stop_all` 逻辑会写 `cancelled`（批量停止路径）。
   - `crates/services/src/services/terminal/launcher.rs:706`
10. Round10：前端收到 `terminal.status_changed` 会走刷新链路。
   - `frontend/src/pages/Workflows.tsx:312`

---

## 3) 主代理交叉核验后的“根因级”实锤问题（去重）

> 仅保留与用户两类现象直接相关，且主代理复核通过的代码问题。

### P1. 仅“切换查看已完成终端”即可触发自动重启链路，导致 completed 回退

#### 证据链（完整）

1. 已完成终端也会渲染 `TerminalEmulator`（不是只读静态视图）。
   - `frontend/src/components/terminal/TerminalDebugView.tsx:231`
2. `TerminalEmulator` 连接 `/terminal/:id`，若无运行进程，后端返回错误消息并断开。
   - `crates/server/src/routes/terminal_ws.rs:123`
   - `crates/server/src/routes/terminal_ws.rs:129`
3. 前端把该错误识别为“进程未运行”后，自动调用 `startTerminal`（用户未输入命令）。
   - `frontend/src/components/terminal/TerminalDebugView.tsx:109`
   - `frontend/src/components/terminal/TerminalDebugView.tsx:130`
4. `startTerminal` 对 409 冲突会自动走 `stop -> retry start`。
   - `frontend/src/components/terminal/TerminalDebugView.tsx:67`
   - `frontend/src/components/terminal/TerminalDebugView.tsx:71`
   - `frontend/src/components/terminal/TerminalDebugView.tsx:76`
5. stop 接口会把终端状态直接重置为 `not_started`。
   - `crates/server/src/routes/terminals.rs:565`
   - `crates/server/src/routes/terminals.rs:567`
6. 随后重试 start 成功后，终端会进入 `waiting` 并广播。
   - `crates/services/src/services/terminal/launcher.rs:334`
   - `crates/services/src/services/terminal/launcher.rs:342`

#### 对应用户现象

- 用户只是点回终端 2 查看状态，终端 2 从 `completed` 变 `waiting`。
- 该链路不需要人工输入命令即可触发（与设计期望冲突）。

---

### P2. 终端完成事件处理存在“强前置条件”，满足不了就直接丢弃，导致最后终端可残留执行中

#### 证据链

1. 成功完成事件要求 terminal 当前状态是 `working`，否则直接忽略。
   - `crates/services/src/services/orchestrator/agent.rs:251`
2. 完成处理还要求 CAS `working -> completed` 成功；失败直接返回，不推进任务/工作流。
   - `crates/services/src/services/orchestrator/agent.rs:291`
   - `crates/services/src/services/orchestrator/agent.rs:375`
3. 若事件被忽略/返回，后续任务/工作流状态推进链不会执行。
   - `crates/services/src/services/orchestrator/agent.rs:397`
   - `crates/services/src/services/orchestrator/agent.rs:433`
   - `crates/services/src/services/orchestrator/agent.rs:467`

#### 对应用户现象

- “最后一个终端明明完成了，仍显示执行中”。
- 特别是在 P1 触发后（状态被重置/重启）更容易命中该丢弃条件。

---

### P3. 成功完成会被 quiet window（40s）延迟，不是立即完成态

#### 证据链

1. 成功完成先检查 quiet window，不满足就 defer 并 return。
   - `crates/services/src/services/orchestrator/agent.rs:268`
   - `crates/services/src/services/orchestrator/agent.rs:273`
   - `crates/services/src/services/orchestrator/agent.rs:281`
2. defer 后通过异步任务等待再重新发布完成事件。
   - `crates/services/src/services/orchestrator/agent.rs:515`
   - `crates/services/src/services/orchestrator/agent.rs:541`

#### 对应用户现象

- 终端已完成但短时间仍显示执行中（时间窗口内可见）。

---

### P4. 工作流“完成”依赖指令分支，不是由“终端全完成”直接自动落库

#### 证据链

1. 编排器内写入 `workflow completed` 的显式路径在 `CompleteWorkflow` 指令分支。
   - `crates/services/src/services/orchestrator/agent.rs:1126`
   - `crates/services/src/services/orchestrator/agent.rs:1136`

#### 对应用户现象

- 出现“终端看起来都结束了，但工作流仍执行中”的状态残留风险。

---

### P5. 事件总线在无订阅者时会直接丢消息（会放大状态展示残留）

#### 证据链

1. 无订阅者直接 drop。
   - `crates/services/src/services/orchestrator/message_bus.rs:164`
   - `crates/services/src/services/orchestrator/message_bus.rs:168`
2. 全是关闭订阅者也 drop。
   - `crates/services/src/services/orchestrator/message_bus.rs:201`
   - `crates/services/src/services/orchestrator/message_bus.rs:205`

#### 对应用户现象

- 事件丢失时前端可能维持旧状态（尤其依赖事件触发刷新的页面）。

---

## 4) 已排除项（代码证据）

### E1. “点列表按钮本身会改状态”已排除

- 点击终端列表仅 `setSelectedTerminalId`，无直接状态写操作。
  - `frontend/src/components/terminal/TerminalDebugView.tsx:193`

### E2. “Codex 有独立状态机导致该问题”未找到代码实锤

- CLI 差异主要在命令名映射（`claude/gemini/codex`），状态写入链路共用同一套。
  - `crates/services/src/services/terminal/launcher.rs:583`
  - `crates/services/src/services/terminal/launcher.rs:587`
  - `crates/services/src/services/terminal/launcher.rs:334`

### E3. “前端完全不收 WS 消息”已排除

- `ws.onmessage` 正常解析并分发 handler。
  - `frontend/src/stores/wsStore.ts:909`
  - `frontend/src/stores/wsStore.ts:926`

---

## 5) 与两个用户问题的一一对应

### 问题一：切换查看终端 2 时 completed -> waiting

- 根因主链：`P1`（自动重启链路）
- 放大链：`P2`（完成事件前置条件严格导致状态收敛失败）

### 问题二：三个终端完成后仍显示执行中（尤其最后一个）

- 根因候选链（均为实锤代码路径）：`P2` + `P3` + `P4` + `P5`

---

## 6) 结论

- 本次按要求完成：3 个 sub-agent，各自 10 轮，共 30 轮实锤分析。
- 未做任何修复。
- 就当前代码可证据范围，已完成去重并定位到上述根因级问题。
- 结论：**已找到全部代码层实锤问题（与本次两类现象直接相关）**。

