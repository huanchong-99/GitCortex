# Phase 14: Orchestrator 运行时接入与状态机完备（详细实施计划）

> **状态:** ⬜ 未开始  
> **进度追踪:** 查看 `TODO.md`  
> **前置条件:** Phase 13 完成  

## 目标

1. Orchestrator 作为运行时服务可被启动/停止。  
2. `start_workflow` 触发真实执行流程。  
3. 状态机完整、可恢复、可追踪。  

## 非目标

- 不处理前端 UI 细节（Phase 16）。  
- 不进行发布流程（Phase 18）。  

## 参考资料

- `docs/plans/2026-01-16-orchestrator-design.md`（主设计文档）  
- `crates/services/src/services/orchestrator/agent.rs`  
- `crates/services/src/services/orchestrator/state.rs`  

---

## 新手准备清单

1) 阅读状态枚举：  
```
workflow: created -> starting -> ready -> running -> merging -> completed/failed
```

2) 熟悉 Orchestrator 现有组件：  
- OrchestratorAgent  
- MessageBus  
- OrchestratorState  

---

## Task 14.1: Orchestrator 运行时服务装配（Deployment 容器）

**状态:** ⬜ 未开始  

**目标:**  
把 Orchestrator 作为服务注入容器，并允许按 workflow_id 启动/停止。

**涉及文件:**  
- 新增: `crates/services/src/services/orchestrator/runtime.rs`  
- 修改: `crates/services/src/services/container.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.1.1: 创建 Runtime 结构  
```rust
pub struct OrchestratorRuntime {
    agents: Arc<Mutex<HashMap<String, OrchestratorAgent>>>,
}
```

Step 14.1.2: 实现 start/stop 方法  
- start: 检查是否已运行 -> 创建 agent -> spawn task  
- stop: 发送停止信号 -> 移除 agent  

Step 14.1.3: 注入容器  
- 在 ServiceContainer 中新增字段  
- 在初始化时创建 Runtime 实例  

**验收标准:**  
- `runtime.start(id)` 可创建并运行 agent  
- `runtime.stop(id)` 可安全停止  

---

## Task 14.2: start_workflow 触发编排流程与状态迁移

**状态:** ⬜ 未开始  

**目标:**  
`POST /api/workflows/:id/start` 触发真实运行。

**涉及文件:**  
- 修改: `crates/server/src/routes/workflows.rs`  
- 修改: `crates/db/src/models/workflow.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.2.1: 校验 workflow 状态  
- 必须是 `ready` 才允许启动  

Step 14.2.2: 组装 OrchestratorConfig  
- 从 workflow 读取 api_type/base_url/model  

Step 14.2.3: 调用 runtime.start  
- 失败时返回错误并保持状态不变  

Step 14.2.4: 更新状态为 `running`  

**验收标准:**  
- start 后 workflow 状态为 running  
- 无 ready 状态时返回 400  

---

## Task 14.3: 终端启动序列（cc-switch 串行启动 / 并行运行）

**状态:** ⬜ 未开始  

**目标:**  
启动阶段串行，执行阶段并行。

**涉及文件:**  
- 修改: `crates/services/src/services/orchestrator/agent.rs`  
- 修改: `crates/services/src/services/cc_switch.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.3.1: 取出所有终端  
- 按 task/order_index 排序  

Step 14.3.2: 逐个终端启动  
- 切换模型 -> 启动 terminal  

Step 14.3.3: 启动完成后更新状态  
- terminal: waiting  
- workflow: ready  

**验收标准:**  
- 启动顺序正确  
- 启动后所有终端处于 waiting  

---

## Task 14.4: 任务/终端状态更新与事件广播

**状态:** ⬜ 未开始  

**目标:**  
状态变化可推送到前端。

**涉及文件:**  
- 修改: `crates/services/src/services/orchestrator/message_bus.rs`  
- 修改: `crates/server/src/routes/events.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.4.1: 关键状态点发送事件  
- terminal waiting -> running -> completed  
- task pending -> running -> completed  

Step 14.4.2: 状态写入数据库  
- 更新 task/terminal 表  

Step 14.4.3: 广播事件到前端  
- SSE 或 WebSocket  

**验收标准:**  
- 前端能实时接收状态更新  

---

## Task 14.5: GitWatcher 事件驱动接入 Orchestrator

**状态:** ⬜ 未开始  

**目标:**  
Git 提交驱动任务状态变化。

**涉及文件:**  
- 修改: `crates/services/src/services/git_watcher/*`  
- 修改: `crates/services/src/services/orchestrator/agent.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.5.1: 定义 commit message 规则  
- `#done` -> task completed  
- `#review` -> review_pending  
- `#fail` -> failed  

Step 14.5.2: 解析并转换为事件  
- 发布到 message bus  

Step 14.5.3: 更新 DB 状态  

**验收标准:**  
- commit message 能推动任务状态变化  

---

## Task 14.6: Merge Terminal 合并流程与冲突处理

**状态:** ⬜ 未开始  

**目标:**  
完成分支合并并处理冲突。

**涉及文件:**  
- 修改: `crates/services/src/services/orchestrator/agent.rs`  
- 修改: `crates/services/src/services/git.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.6.1: 合并前运行测试  
- 如果失败，停止合并  

Step 14.6.2: 执行合并  
- 成功 -> workflow completed  
- 冲突 -> workflow merging  

Step 14.6.3: 冲突修复入口  
- 通知前端  

**验收标准:**  
- 合并流程可正常执行  

---

## Task 14.7: Error Terminal 异常处理流程

**状态:** ⬜ 未开始  

**目标:**  
失败任务自动进入修复流程。

**涉及文件:**  
- 修改: `crates/services/src/services/orchestrator/agent.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.7.1: 任务失败触发 error terminal  
Step 14.7.2: 更新 workflow 状态为 failed  
Step 14.7.3: UI 提供修复入口  

**验收标准:**  
- 失败路径可进入错误终端  

---

## Task 14.8: 运行态持久化与恢复（重启续跑）

**状态:** ⬜ 未开始  

**目标:**  
服务重启后可恢复运行态。

**涉及文件:**  
- 修改: `crates/services/src/services/orchestrator/state.rs`  
- 修改: `crates/db/src/models/workflow.rs`  

**实施步骤（新手可逐步照做）:**  

Step 14.8.1: 保存关键状态  
- 保存 workflow/task/terminal 状态  

Step 14.8.2: 服务启动时恢复  
- 加载 running/ready workflow  

Step 14.8.3: 校验一致性  
- 如果进程不存在，标记 failed  

**验收标准:**  
- 重启后 workflow 可继续运行  
