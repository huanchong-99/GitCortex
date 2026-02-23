# 2026-02-11 第5轮实锤问题分析与修复记录

## 说明

本轮遵循“禁止假设，只基于真实代码路径”的原则，使用多轮子代理并行深挖后，由主代理二次核验并落地最小修复。

## 本轮实锤问题（已核验）

1. 终端串行交接在下一终端未到 `waiting` 时直接跳过且不重试，导致卡住。
   - 证据：`crates/services/src/services/orchestrator/agent.rs:638`
   - 旧行为：`dispatch_next_terminal` 仅检查一次状态，不是 `waiting` 就返回。

2. GitEvent 路径对 `status=completed` 不区分 `next_action=continue/retry`，会误推进 handoff。
   - 证据：`crates/services/src/services/orchestrator/agent.rs:777`
   - 对比语义：GitWatcher 已将 `continue/retry` 视为非 completion（不发布 TerminalCompleted）。

3. Prompt 输入投递失败时，状态机停留在 `Responding`，后续同类 prompt 会被抑制窗口影响。
   - 证据：`crates/services/src/services/orchestrator/prompt_handler.rs:161`
   - 旧行为：发布失败仅改 UI 决策为 `skip`，不重置状态机。

4. Workflows 页面 WebSocket handlers 每次渲染是新对象，存在 unsubscribe/subscribe 抖动窗口。
   - 证据：`frontend/src/pages/Workflows.tsx:305`

5. Prepare/Start/Pause/Stop 只失效详情缓存，不失效列表缓存，列表状态容易滞后。
   - 证据：`frontend/src/hooks/useWorkflows.ts:492`

6. `projectId` 自动纠正时未清理已选 workflow，存在跨项目 selection 残留。
   - 证据：`frontend/src/pages/Workflows.tsx:146`

7. Pipeline 任务与终端未按 `orderIndex` 排序，顺序可能与执行顺序不一致。
   - 证据：`frontend/src/pages/Workflows.tsx:482`

## 最小修复（本次已落地）

1. 交接重试：`dispatch_next_terminal` 增加有限等待重试，直到 `waiting` 或终态。
2. 语义对齐：`handle_git_event` 中对 `continue/retry` 的 completed 提交不触发 handoff。
3. 状态回退：Prompt 投递失败时重置对应终端 prompt 状态机。
4. 订阅稳定：Workflows 页将 WS handlers 用 `useMemo` 固定引用。
5. 缓存一致：Prepare/Start/Pause/Stop 成功后同时失效 `workflowKeys.all`。
6. 选择隔离：`projectId` 自动修正时清空 `selectedWorkflowId`。
7. 顺序一致：Pipeline 映射前按 `task.orderIndex` 和 `terminal.orderIndex` 排序。

## 本地验证清单

1. Frontend 定向测试（Workflows / wsStore / hooks）
2. Services 包测试（orchestrator / prompt / message bus）
3. 全量关键回归通过后再提交与推送

## 结论

本轮只处理“代码实锤问题”。
修复后将继续执行：本地验证 -> 提交 -> 推送 -> 监控远端 CI 直到成功。
