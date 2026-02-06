# Phase 25: 自动确认可靠性修复（Phase 24 补强）

> **状态:** 📋 待实施
> **优先级:** 🔴 高（线上稳定性）
> **目标:** 修复"终端显示 working 但无输出、无文件变化"的链路断点，确保自动确认能力在无前端连接时仍可工作
> **创建时间:** 2026-02-06
> **前置条件:** Phase 24 终端自动确认与消息桥接已完成
> **触发案例:** Workflow `97bbe293-7396-4c23-a424-09d254b2948b`（运行数分钟，T1=working，工作区无新增文件，前端黑屏）

---

## 问题背景

### 已确认问题

1. **前端创建请求缺少 `autoConfirm` 字段**
   - `CreateWorkflowRequest` 的 terminal 对象未传 `autoConfirm`
   - 后端 `auto_confirm` 缺省为 `false`
   - CLI 启动时未注入自动确认参数（Claude/Codex/Gemini）

2. **PromptWatcher 依赖 WebSocket 输出路径**
   - `PromptWatcher.process_output` 主要由 `terminal_ws` 输出流程驱动
   - 一旦前端 WS 未连接/异常，提示检测和自动决策链路会一起失效

3. **前端黑屏与输出链路相关**
   - `terminal_ws` 的 UTF-8 流式解码容错不足
   - 可能导致"进程仍运行但 UI 长时间无可显示文本"

4. **表现一致**
   - 终端状态仍为 `working`（进程活着）
   - 但任务推进依赖的确认输入未送达，实际执行停滞

---

## 总体修复目标

### 目标定义（DoD）

1. 新建 workflow 的 terminal 默认 `autoConfirm=true`，并可靠落库
2. PromptWatcher 脱离前端 WS 依赖，改为后端独立后台消费 PTY 输出
3. 终端输出链路具备编码容错，不再出现长期黑屏
4. 链路日志可追踪：`launch_config -> prompt_detected -> prompt_decision -> terminal_input`

### 预期效果

- 无终端页面打开时，workflow 仍能自动通过非敏感确认提示
- 遇到密码/敏感提示时进入 `waiting_for_approval`，而非静默卡住
- 黑屏场景可恢复并持续显示后续输出
- 线上故障可在分钟级定位断点

---

## 实施计划（按优先级）

## P0 - 自动确认参数必达（立即止血）

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 25.1 | 前端 terminal payload 增加 `autoConfirm` 字段，默认 `true` | ⬜ |  |
| 25.2 | 后端 `auto_confirm` 缺省兜底改为 `true`（保留显式 `false`） | ⬜ |  |

### Task 25.1 详细说明

**目标描述**
- 让工作流创建链路显式传递 `autoConfirm: true`，避免依赖后端缺省值。

**需要修改的文件**
- `frontend/src/hooks/useWorkflows.ts`
- `frontend/src/components/workflow/types.ts`
- `frontend/src/components/workflow/types.test.ts`
- `frontend/src/hooks/useWorkflows.test.tsx`

**具体步骤**
1. 在 `CreateWorkflowRequest` 的 terminal 结构增加 `autoConfirm?: boolean`
2. 在 `wizardConfigToCreateRequest` 的 terminal 组装中写入 `autoConfirm: true`
3. 更新相关单测，断言请求体包含 `autoConfirm: true`

**完成标准**
- 网络请求体中每个 terminal 均包含 `autoConfirm: true`
- 新创建 terminal 行 `auto_confirm=1`

**测试验证方法**
- 前端单测：请求映射断言
- 联调抓包：确认字段存在且值正确

---

### Task 25.2 详细说明

**目标描述**
- 即使客户端漏传字段，也确保自动确认参数默认启用（除非显式关闭）。

**需要修改的文件**
- `crates/db/src/models/workflow.rs`
- `crates/db/src/models/terminal.rs`
- `crates/services/src/services/cc_switch.rs`
- `crates/services/src/services/terminal/launcher.rs`
- `crates/server/src/routes/terminals.rs`

**具体步骤**
1. 将 `auto_confirm` 的 serde 缺省值改为 `true`（使用默认函数而非裸 `default`）
2. 保留显式 `autoConfirm=false` 的兼容语义
3. 强化启动日志字段：`terminal_id`、`auto_confirm`、`cli args`

**完成标准**
- 漏传 `autoConfirm` 仍可注入 `--dangerously-skip-permissions` / `--yolo`
- 显式传 `false` 时不注入自动确认参数

**测试验证方法**
- 后端反序列化单测：缺省为 `true`
- 启动配置单测：`true/false` 分支均正确

---

## P1 - PromptWatcher 后台解耦（根因修复）

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 25.3 | 建立 PTY 输出后台扇出通道（WS/UI 与 PromptWatcher 解耦） | ⬜ |  |
| 25.4 | PromptWatcher 改为独立后台任务，覆盖 workflow 启动与手动启动路径 | ⬜ |  |

### Task 25.3 详细说明

**目标描述**
- 将 PTY 输出读取从 `terminal_ws` 单点路径抽离，支持多消费者订阅。

**需要修改的文件**
- `crates/services/src/services/terminal/process.rs`
- `crates/services/src/services/terminal/mod.rs`
- `crates/server/src/routes/terminal_ws.rs`

**具体步骤**
1. 在 ProcessManager/TrackedProcess 增加输出广播通道（fanout）
2. 后台 reader 持续读取 PTY 并写入广播通道
3. `terminal_ws` 改为订阅输出通道，不再直接独占 PTY reader

**完成标准**
- 无前端连接时，PTY 输出仍被后端持续消费
- 多订阅者并存时输出不丢失、不互抢、不重复

**测试验证方法**
- 单测：多订阅者 fanout 正确
- 集成测试：无 WS 连接仍可产生 prompt_detected 事件

---

### Task 25.4 详细说明

**目标描述**
- PromptWatcher 不依赖 `terminal_ws.process_output`，改为独立后台监听任务。

**需要修改的文件**
- `crates/services/src/services/terminal/prompt_watcher.rs`
- `crates/services/src/services/terminal/launcher.rs`
- `crates/server/src/routes/terminals.rs`
- `crates/server/src/routes/workflows.rs`

**具体步骤**
1. terminal 启动后自动创建 watcher 后台订阅任务
2. 覆盖两条路径：workflow prepare 启动、`/api/terminals/:id/start` 启动
3. 终端停止/重启时正确取消监听并清理状态机

**完成标准**
- 无前端 WS 时，prompt 检测和决策回写仍可完成
- `Password`/敏感输入仍保持 AskUser 策略

**测试验证方法**
- 集成测试：不开终端页面也可自动通过 Enter/YesNo 提示
- 回归测试：Password 场景进入 `waiting_for_approval`

---

## P2 - 黑屏修复与可观测性补齐（稳定性与诊断）

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 25.5 | 修复 `terminal_ws` UTF-8 流式解码容错，避免长期黑屏 | ⬜ |  |
| 25.6 | 增强诊断日志与回归场景（有WS/无WS/断连重连） | ⬜ |  |

### Task 25.5 详细说明

**目标描述**
- 处理非法字节场景，确保输出流可恢复而非永久等待。

**需要修改的文件**
- `crates/server/src/routes/terminal_ws.rs`

**具体步骤**
1. 区分"尾部不完整 UTF-8"与"中间非法字节"
2. 对非法字节采用丢弃或 lossy 策略，避免 pending buffer 堵死
3. 输出解码异常统计日志，支持线上诊断

**完成标准**
- `valid + invalid + valid` 字节流仍可持续输出文本
- 不再出现长时间黑屏且无恢复

**测试验证方法**
- 新增/扩展 UTF-8 流式解码单测
- 手工回归：模拟乱码字节后输出恢复

---

### Task 25.6 详细说明

**目标描述**
- 补齐可观测性与回归策略，确保故障可快速定位、可稳定复现和验证。

**需要修改的文件**
- `crates/services/src/services/terminal/bridge.rs`
- `crates/services/src/services/terminal/prompt_watcher.rs`
- `crates/services/src/services/orchestrator/prompt_handler.rs`
- `crates/server/src/routes/workflow_events.rs`
- `docs/plans/TODO.md`

**具体步骤**
1. 统一链路日志字段：workflow_id/terminal_id/session_id/prompt_kind/decision
2. 增加端到端验证矩阵：有 WS、无 WS、WS 断连重连
3. 输出标准排障 checklist（SQL + 日志关键字 + 事件核验）

**完成标准**
- 故障定位可以明确到具体断链环节
- 回归测试能覆盖本次事故同类场景

**测试验证方法**
- 后端集成测试 + 前端交互回归
- 事件顺序校验：detect -> decision -> input

---

## 风险评估与注意事项

1. **P1 改造风险最高**
   - 输出扇出设计不当可能引入输出重复或丢失
   - 必须先完成多订阅者行为测试再推进全链路替换

2. **安全边界**
   - `autoConfirm` 默认开启仅用于权限确认类提示
   - 密码/token/secret 继续强制 AskUser，不自动注入敏感输入

3. **兼容性**
   - 保留显式 `autoConfirm=false` 能力，便于安全敏感场景降级

4. **启动路径一致性**
   - 手动 terminal 启动路径必须与 workflow 启动路径保持 watcher 行为一致

---

## 数据库迁移评估

- **结论：无需新增结构迁移**
  - `terminal.auto_confirm` 列已存在
- **可选操作**
  - 增加一次性数据修复脚本，将历史误置 `auto_confirm=0` 的记录按规则回填（需先 dry-run）

---

## 验收条件（Exit Criteria）

- ✅ 新建 workflow terminal 默认 `auto_confirm=1`
- ✅ CLI 启动参数与 terminal 自动确认配置一致
- ✅ 无前端连接时 PromptWatcher 仍能检测并驱动自动响应
- ✅ 黑屏复现场景修复并通过回归
- ✅ 链路日志可追踪并能快速定位断点

---

## 里程碑建议

- **M1（P0）**：字段与默认值修复完成，阻断主故障
- **M2（P1）**：Watcher 独立后台化完成，脱离 WS 依赖
- **M3（P2）**：黑屏修复与可观测性完善，完成稳定性验收
