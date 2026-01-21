# Phase 16: 工作流前端体验完备（详细实施计划）

> **状态:** ⬜ 未开始  
> **进度追踪:** 查看 `TODO.md`  
> **前置条件:** Phase 15 完成  

## 目标

1. 前端使用真实 API 数据渲染 workflow。  
2. Pipeline/Debug 页面实时显示终端状态。  
3. 向导提交结构与后端契约一致。  

## 参考资料

- `frontend/src/pages/Workflows.tsx`  
- `frontend/src/pages/WorkflowDebug.tsx`  
- `frontend/src/components/workflow/*`  

---

## 新手准备清单

1) 先阅读共享类型：`shared/types.ts`  
2) 再阅读现有 hooks：`frontend/src/hooks/useWorkflows.ts`  

---

## Task 16.1: Workflows 列表/详情改为真实任务数据

**状态:** ⬜ 未开始  

**目标:**  
列表与详情完全基于 API 返回。

**涉及文件:**  
- 修改: `frontend/src/hooks/useWorkflows.ts`  
- 修改: `frontend/src/pages/Workflows.tsx`  

**实施步骤（新手可逐步照做）:**  

Step 16.1.1: 替换类型  
- 从 `shared/types.ts` 引入 DTO  
- 删除旧 `WorkflowConfig` 类型  

Step 16.1.2: 调整字段命名  
- `project_id` -> `projectId`  
- `created_at` -> `createdAt`  

Step 16.1.3: 列表渲染  
- `workflow.tasks.length`  
- `workflow.status`  

**验收标准:**  
- 列表不再使用 mock 数据  

---

## Task 16.2: PipelineView 显示真实任务/终端状态

**状态:** ⬜ 未开始  

**目标:**  
PipelineView 使用真实任务数据。

**涉及文件:**  
- 修改: `frontend/src/components/workflow/PipelineView.tsx`  
- 修改: `frontend/src/components/workflow/TerminalCard.tsx`  

**实施步骤（新手可逐步照做）:**  

Step 16.2.1: 调整 props  
- 接收 tasks/terminals 数组  

Step 16.2.2: 状态映射  
- `pending` -> idle  
- `running` -> running  

Step 16.2.3: 渲染合并终端  

**验收标准:**  
- PipelineView 正确显示状态  

---

## Task 16.3: WorkflowDebug 实时终端调试接入

**状态:** ⬜ 未开始  

**目标:**  
Debug 页面实时显示终端输出。

**涉及文件:**  
- 修改: `frontend/src/pages/WorkflowDebug.tsx`  
- 修改: `frontend/src/components/terminal/TerminalDebugView.tsx`  

**实施步骤（新手可逐步照做）:**  

Step 16.3.1: 使用真实 tasks/terminals  
- 不再使用 `config`  

Step 16.3.2: WebSocket 连接  
- `ws://host/api/terminal_ws/:terminal_id`  

Step 16.3.3: 状态更新  
- 监听事件并刷新 UI  

**验收标准:**  
- Debug 页面可实时输出  

---

## Task 16.4: WorkflowWizard 提交 payload/校验对齐

**状态:** ⬜ 未开始  

**目标:**  
向导提交结构与后端契约一致。

**涉及文件:**  
- 修改: `frontend/src/components/workflow/WorkflowWizard.tsx`  
- 修改: `frontend/src/components/workflow/types.ts`  

**实施步骤（新手可逐步照做）:**  

Step 16.4.1: 字段命名统一  
- `projectId`  
- `useSlashCommands`  

Step 16.4.2: 校验规则  
- 至少 1 个任务  
- 每个任务至少 1 个终端  

Step 16.4.3: 错误提示  
- 统一 toast/alert  

**验收标准:**  
- 请求可通过后端验证  

---

## Task 16.5: 启动/暂停/停止控制与权限提示

**状态:** ⬜ 未开始  

**目标:**  
提供完整控制操作。

**涉及文件:**  
- 修改: `frontend/src/pages/Workflows.tsx`  
- 修改: `frontend/src/pages/WorkflowDebug.tsx`  

**实施步骤（新手可逐步照做）:**  

Step 16.5.1: 添加按钮  
- Start / Pause / Stop  

Step 16.5.2: 禁用非法状态  
- 只有 ready 可 Start  

Step 16.5.3: 操作反馈  
- 成功提示  
- 失败显示错误  

**验收标准:**  
- 按钮行为正确  

---

## Task 16.6: i18n/错误态/空态完善

**状态:** ⬜ 未开始  

**目标:**  
完善国际化和错误提示。

**涉及文件:**  
- 修改: `frontend/src/i18n/locales/zh-Hans/workflow.json`  
- 修改: `frontend/src/i18n/locales/en/workflow.json`  

**实施步骤（新手可逐步照做）:**  

Step 16.6.1: 添加缺失文案  
Step 16.6.2: 统一错误显示  
Step 16.6.3: 空态引导优化  

**验收标准:**  
- 文案全部可翻译  
