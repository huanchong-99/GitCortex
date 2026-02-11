# 2026-02-11 终端历史查看出现「Disconnected from terminal stream」问题定位（仅定位，不修复）

## 0) 任务边界

- 本文档仅记录**日志 + 代码实锤**定位结果。
- 不包含任何修复实现。
- 分析方式：主代理 + 3 个 sub-agent 交叉取证。

---

## 1) 复现现象（用户描述）

1. 终端1完成后，终端2开始工作时，终端1出现：
   `Disconnected from terminal stream. Click Restart to reconnect.`
2. 全部任务完成后查看历史，点击终端1/2会出现同样提示。
3. 终端3通常不出现该提示（或出现概率低）。
4. 状态未回退（本次关注的是“断流提示”而非状态回退）。

---

## 2) 日志证据（本地后端日志）

### 2.1 完成后存在主动关停链路（实锤）

- 终端2完成后，编排器记录“发出 completion shutdown 信号”：
  - `.logs/backend-23456.log:355`
- 同一终端随后记录“完成后强制终止进程”：
  - `.logs/backend-23456.log:356`
- 终端3同样出现“completion shutdown + force-terminate”：
  - `.logs/backend-23456.log:388`
  - `.logs/backend-23456.log:389`

### 2.2 历史终端被点击后，后端明确报“无运行进程”（实锤）

- 终端2被连接时：
  - `.logs/backend-23456.log:404`
  - `.logs/backend-23456.log:406`
- 终端1被连接时：
  - `.logs/backend-23456.log:408`
  - `.logs/backend-23456.log:410`

### 2.3 最后终端在该轮中更多表现为“连接保持/超时断开”

- 终端3出现的是 idle timeout 断开记录：
  - `.logs/backend-23456.log:435`
  - `.logs/backend-23456.log:436`

> 说明：日志中未直接打印前端英文提示文本；该提示由前端组件常量渲染（见第3节代码证据）。

---

## 3) 代码证据链（前后端）

### 3.1 前端会对 `completed` 终端继续渲染实时 WS 终端组件

- `TerminalDebugView` 渲染 `TerminalEmulator` 的条件包含 `completed`：
  - `frontend/src/components/terminal/TerminalDebugView.tsx:244`
  - `frontend/src/components/terminal/TerminalDebugView.tsx:247`
  - `frontend/src/components/terminal/TerminalDebugView.tsx:248`

这意味着“查看历史已完成终端”仍会主动发起 WS 连接，而不是只读历史日志视图。

### 3.2 前端断流提示文本与触发条件是固定路径

- 提示文本常量定义：
  - `frontend/src/components/terminal/TerminalEmulator.tsx:17`
- WS `onerror`/`onclose` 会进入 `disconnected` 状态并展示该提示：
  - `frontend/src/components/terminal/TerminalEmulator.tsx:205`
  - `frontend/src/components/terminal/TerminalEmulator.tsx:212`
  - `frontend/src/components/terminal/TerminalEmulator.tsx:218`
  - `frontend/src/components/terminal/TerminalEmulator.tsx:253`

### 3.3 后端在“无运行进程句柄”时会返回错误并立即断开 WS

- WS 路由建连时先取 process handle；取不到则发送：
  `Terminal process not running. Please start the terminal first.` 然后 `close`：
  - `crates/server/src/routes/terminal_ws.rs:123`
  - `crates/server/src/routes/terminal_ws.rs:129`
  - `crates/server/src/routes/terminal_ws.rs:135`
  - `crates/server/src/routes/terminal_ws.rs:136`
- `get_handle` 未命中则返回 `None`：
  - `crates/services/src/services/terminal/process.rs:981`
  - `crates/services/src/services/terminal/process.rs:1033`
  - `crates/services/src/services/terminal/process.rs:1034`

### 3.4 终端完成后，编排器会主动关停并清理会话绑定

- 完成处理路径调用 `enforce_terminal_completion_shutdown`：
  - `crates/services/src/services/orchestrator/agent.rs:409`
- 该函数内：发送 Ctrl+C + Shutdown、尝试强制终止进程、清空 process/session 绑定：
  - `crates/services/src/services/orchestrator/agent.rs:1467`
  - `crates/services/src/services/orchestrator/agent.rs:1487`
  - `crates/services/src/services/orchestrator/agent.rs:1493`
  - `crates/services/src/services/orchestrator/agent.rs:1503`
  - `crates/services/src/services/orchestrator/agent.rs:1512`
  - `crates/services/src/services/orchestrator/agent.rs:1521`
  - `crates/services/src/services/orchestrator/agent.rs:1530`

---

## 4) 根因归纳（仅实锤）

### 根因 R1：历史终端仍走“实时 WS 终端”渲染

- `completed` 终端被当作可连接实时终端处理，而非历史回放视图。

### 根因 R2：完成后终端进程/会话被主动关停与解绑

- 编排器完成收敛阶段会触发 shutdown + force-terminate，并清空 process/session。

### 根因 R3：历史点击触发 WS 建连时，后端判定“无运行进程”并关闭

- 后端返回错误并关闭连接，前端统一展示“Disconnected from terminal stream...”提示。

> 组合效应：`R1 + R2 + R3` 直接解释“终端1/2历史查看时出现断流提示”。

---

## 5) 关于“终端3通常不出现”的本轮实锤说明

- 在当前这轮日志中，终端3更多表现为连接保持后 idle timeout 断开，而非立即命中“no running process”。
- 对应日志：
  - `.logs/backend-23456.log:435`
  - `.logs/backend-23456.log:436`

因此本轮可确认的是：终端1/2在被重新查看时明确命中“no running process”；终端3在该时段未出现同样模式。

---

## 6) 非本次结论范围

- 本文未进行修复。
- 本文未对“最佳修复方案”做实现验证。
- 本文未引入任何假设场景，仅陈述日志与代码可直接证明的链路。

