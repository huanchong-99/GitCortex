# Phase 15: 终端执行与 WebSocket 链路完善（详细实施计划）

> **状态:** ⬜ 未开始  
> **进度追踪:** 查看 `TODO.md`  
> **前置条件:** Phase 14 完成  

## 目标

1. 终端与 session/execution_process 建立完整链路。  
2. WebSocket 能实时输入/输出。  
3. 终端输出可持久化并回放。  

## 参考资料

- `crates/server/src/routes/terminal_ws.rs`  
- `crates/services/src/services/terminal/*`  
- `crates/db/src/models/terminal.rs`  

---

## 新手准备清单

1) 熟悉终端相关模型：terminal、session、execution_process。  
2) 了解 WebSocket 消息结构（`WsMessage`）。  

---

## Task 15.1: Workflow Terminal 与 Session/ExecutionProcess 绑定

**状态:** ⬜ 未开始  

**目标:**  
终端具备执行上下文，便于追踪与恢复。

**涉及文件:**  
- 修改: `crates/db/src/models/terminal.rs`  
- 修改: `crates/db/src/models/execution_process.rs`  
- 修改: `crates/services/src/services/terminal/launcher.rs`  

**实施步骤（新手可逐步照做）:**  

Step 15.1.1: 创建 session  
- 在终端启动前创建 session 记录  

Step 15.1.2: 创建 execution_process  
- 记录 run_reason  
- 状态初始为 running  

Step 15.1.3: 将关联写回 terminal  
- terminal.session_id  
- terminal.execution_process_id  

**验收标准:**  
- 终端有完整执行上下文  

---

## Task 15.2: PTY 进程生命周期管理与 WebSocket 转发

**状态:** ⬜ 未开始  

**目标:**  
终端输入/输出可实时通过 WebSocket 传输。

**涉及文件:**  
- 修改: `crates/services/src/services/terminal/launcher.rs`  
- 修改: `crates/server/src/routes/terminal_ws.rs`  

**实施步骤（新手可逐步照做）:**  

Step 15.2.1: 启动 PTY 进程  
- 设置工作目录  
- 注入环境变量  

Step 15.2.2: 输入转发  
- `WsMessage::Input` -> 写入 PTY stdin  

Step 15.2.3: 输出转发  
- PTY stdout/stderr -> `WsMessage::Output`  

Step 15.2.4: 断线处理  
- 连接断开时关闭 PTY  

**验收标准:**  
- 前端输入可驱动终端执行  
- 输出实时显示  

---

## Task 15.3: 终端输出持久化与历史回放

**状态:** ⬜ 未开始  

**目标:**  
支持历史输出回放。

**涉及文件:**  
- 新增: `crates/db/src/models/terminal_log.rs`  
- 修改: `crates/services/src/services/terminal/process.rs`  

**实施步骤（新手可逐步照做）:**  

Step 15.3.1: 创建日志表  
- 字段: id, terminal_id, sequence, content, created_at  

Step 15.3.2: 批量写入  
- 每 1 秒 flush  
- 防止高频写入  

Step 15.3.3: 增加查询接口  
- `/api/terminals/:id/logs?offset=`  

**验收标准:**  
- 终端输出可回放  

---

## Task 15.4: 终端超时/取消/清理策略

**状态:** ⬜ 未开始  

**目标:**  
避免僵尸进程和资源泄露。

**涉及文件:**  
- 修改: `crates/services/src/services/terminal/process.rs`  
- 修改: `crates/server/src/routes/terminal_ws.rs`  

**实施步骤（新手可逐步照做）:**  

Step 15.4.1: 超时规则  
- 10 分钟无活动 -> idle  
- 30 分钟 -> 强制关闭  

Step 15.4.2: 手动取消 API  
- `POST /api/terminals/:id/stop`  

Step 15.4.3: 清理状态  
- 更新 terminal.status = failed/cancelled  

**验收标准:**  
- 无活动终端可自动清理  

---

## Task 15.5: CLI 检测与安装指引联动 UI

**状态:** ⬜ 未开始  

**目标:**  
避免未安装 CLI 造成失败。

**涉及文件:**  
- 修改: `crates/server/src/routes/cli_types.rs`  
- 修改: `frontend/src/components/workflow/steps/Step3Models.tsx`  

**实施步骤（新手可逐步照做）:**  

Step 15.5.1: 后端增加字段  
- `isInstalled`  

Step 15.5.2: 前端显示安装提示  
- 未安装的 CLI 显示安装链接  

Step 15.5.3: 禁止选择不可用 CLI  

**验收标准:**  
- 缺失 CLI 无法创建 workflow  

---

## Task 15.6: 终端相关单测/集成测试完善

**状态:** ⬜ 未开始  

**目标:**  
确保终端链路稳定。

**涉及文件:**  
- 新增: `crates/services/tests/terminal_lifecycle_test.rs`  

**实施步骤（新手可逐步照做）:**  

Step 15.6.1: 测试终端启动/关闭  
Step 15.6.2: 测试 WebSocket 输入输出  
Step 15.6.3: 运行测试  
```
cargo test --workspace
```

**验收标准:**  
- 测试稳定通过  
