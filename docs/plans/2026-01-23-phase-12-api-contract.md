# Phase 12: Workflow API 契约与类型生成对齐

> **状态:** ⬜ 未开始  
> **进度追踪:** 查看 `TODO.md`  
> **前置条件:** Phase 11 完成  

## 目标

1. 固化 Workflow API 的请求/响应与状态枚举，避免前后端字段冲突。  
2. 统一 JSON 命名规范为 camelCase，清除 `config` 与 snake_case 历史遗留。  
3. 让共享类型（`shared/types.ts`）成为唯一可信来源。  

## 非目标

- 不在本阶段实现运行时编排逻辑（Orchestrator 启动在 Phase 14）。  
- 不在本阶段实现业务流程 UI（前端渲染在 Phase 16）。  

## 关键输出

- 固定版 API 契约（本文件）。  
- 后端 DTO 对齐与生成类型更新。  
- 前端 hooks 与类型匹配新契约。  
- 合约测试，防止回归。  

## 风险与规避

| 风险 | 说明 | 规避方案 |
|------|------|----------|
| 前后端字段不一致 | `project_id`/`projectId`、`config` 等 | 统一契约 + 合约测试 |
| 状态枚举不统一 | 前端使用 `draft`，后端使用 `created` | 明确状态列表并强制映射 |
| TypeScript 类型漂移 | 手写类型与后端不一致 | 强制使用 `shared/types.ts` |

---

## 统一契约草案（冻结后不可随意更改）

### 命名与字段规则

- 所有 API JSON 统一使用 **camelCase**。  
- 数据库字段保持 snake_case，API DTO 负责转换。  
- 所有时间字段输出 ISO 8601 字符串（UTC）。  

### 字段映射表（核心字段）

| 领域 | API 字段 | DB 字段 | 备注 |
|------|----------|---------|------|
| Workflow | projectId | project_id | JSON 使用 camelCase |
| Workflow | useSlashCommands | use_slash_commands | 布尔值 |
| Workflow | orchestratorApiType | orchestrator_api_type | 可为空 |
| Terminal | workflowTaskId | workflow_task_id | 外键 |
| Terminal | cliTypeId | cli_type_id | CLI 类型 |

### Create Workflow Request（POST /api/workflows）

```json
{
  "projectId": "proj-xxx",
  "name": "Login Refactor",
  "description": "Split auth workflow into tasks",
  "useSlashCommands": true,
  "commandPresetIds": ["cmd-write-code", "cmd-review"],
  "commands": [
    { "presetId": "cmd-write-code", "orderIndex": 0, "customParams": "{\"tone\":\"strict\"}" },
    { "presetId": "cmd-review", "orderIndex": 1, "customParams": null }
  ],
  "orchestratorConfig": {
    "apiType": "openai-compatible",
    "baseUrl": "https://api.xxx.com",
    "apiKey": "sk-xxx",
    "model": "gpt-4o"
  },
  "errorTerminalConfig": {
    "cliTypeId": "cli-claude-code",
    "modelConfigId": "model-claude-sonnet",
    "customBaseUrl": null,
    "customApiKey": null
  },
  "mergeTerminalConfig": {
    "cliTypeId": "cli-codex",
    "modelConfigId": "model-codex-gpt4o",
    "customBaseUrl": null,
    "customApiKey": null
  },
  "targetBranch": "main",
  "tasks": [
    {
      "id": "task-1",
      "name": "Backend auth",
      "description": "Fix login API",
      "branch": "workflow/login-auth",
      "orderIndex": 0,
      "terminals": [
        {
          "id": "terminal-1",
          "cliTypeId": "cli-claude-code",
          "modelConfigId": "model-claude-sonnet",
          "customBaseUrl": null,
          "customApiKey": null,
          "role": "Implement API",
          "roleDescription": "Focus on API layer",
          "orderIndex": 0
        }
      ]
    }
  ]
}
```

**说明:**  
- `commands` 优先级高于 `commandPresetIds`。  
- 若只传 `commandPresetIds`，后端按数组顺序创建命令。  

### Workflow Detail Response（GET /api/workflows/:id）

```json
{
  "id": "wf-xxx",
  "projectId": "proj-xxx",
  "name": "Login Refactor",
  "description": "Split auth workflow into tasks",
  "status": "created",
  "useSlashCommands": true,
  "orchestratorEnabled": true,
  "orchestratorApiType": "openai-compatible",
  "orchestratorBaseUrl": "https://api.xxx.com",
  "orchestratorModel": "gpt-4o",
  "errorTerminalEnabled": true,
  "errorTerminalCliId": "cli-claude-code",
  "errorTerminalModelId": "model-claude-sonnet",
  "mergeTerminalCliId": "cli-codex",
  "mergeTerminalModelId": "model-codex-gpt4o",
  "targetBranch": "main",
  "readyAt": null,
  "startedAt": null,
  "completedAt": null,
  "createdAt": "2026-01-23T10:00:00Z",
  "updatedAt": "2026-01-23T10:00:00Z",
  "tasks": [
    {
      "id": "task-1",
      "workflowId": "wf-xxx",
      "vkTaskId": null,
      "name": "Backend auth",
      "description": "Fix login API",
      "branch": "workflow/login-auth",
      "status": "pending",
      "orderIndex": 0,
      "startedAt": null,
      "completedAt": null,
      "createdAt": "2026-01-23T10:00:00Z",
      "updatedAt": "2026-01-23T10:00:00Z",
      "terminals": [
        {
          "id": "terminal-1",
          "workflowTaskId": "task-1",
          "cliTypeId": "cli-claude-code",
          "modelConfigId": "model-claude-sonnet",
          "customBaseUrl": null,
          "customApiKey": null,
          "role": "Implement API",
          "roleDescription": "Focus on API layer",
          "orderIndex": 0,
          "status": "not_started",
          "createdAt": "2026-01-23T10:00:00Z",
          "updatedAt": "2026-01-23T10:00:00Z"
        }
      ]
    }
  ],
  "commands": [
    {
      "id": "workflow-cmd-1",
      "workflowId": "wf-xxx",
      "presetId": "cmd-write-code",
      "orderIndex": 0,
      "customParams": null,
      "createdAt": "2026-01-23T10:00:00Z",
      "preset": {
        "id": "cmd-write-code",
        "command": "/write-code",
        "description": "编写功能代码",
        "promptTemplate": "...",
        "isSystem": true,
        "createdAt": "2026-01-23T10:00:00Z",
        "updatedAt": "2026-01-23T10:00:00Z"
      }
    }
  ]
}
```

### List Workflows Response（GET /api/workflows?projectId=...）

```json
[
  {
    "id": "wf-xxx",
    "projectId": "proj-xxx",
    "name": "Login Refactor",
    "description": "Split auth workflow into tasks",
    "status": "running",
    "createdAt": "2026-01-23T10:00:00Z",
    "updatedAt": "2026-01-23T10:00:00Z",
    "tasksCount": 3,
    "terminalsCount": 6
  }
]
```

### 状态枚举（必须统一）

- workflow: `created | starting | ready | running | paused | merging | completed | failed | cancelled`
- workflow_task: `pending | running | review_pending | completed | failed | cancelled`
- terminal: `not_started | waiting | working | completed | failed`

---

## Task 12.1: 冻结 Workflow API 契约（请求/响应/状态枚举）

**状态:** ⬜ 未开始

**目标:**  
将本文件“统一契约草案”确定为唯一来源，并记录决策点。

**涉及文件:**  
- 更新: `docs/plans/2026-01-23-phase-12-api-contract.md`

**实施步骤:**  

Step 12.1.1: 阅读设计文档关键部分  
- `docs/plans/2026-01-16-orchestrator-design.md`（数据模型与状态枚举）  
- `docs/plans/2026-01-16-gitcortex-implementation.md`（API 与前端结构）  

Step 12.1.2: 列出当前代码已实现字段与状态  
```
rg -n "WorkflowDetailResponse|WorkflowStatus|workflow_task" crates -g "*.rs"
rg -n "useWorkflows|WorkflowDebug|WorkflowWizard" frontend -g "*.tsx"
```

Step 12.1.3: 对齐并冻结字段命名与枚举  
- 逐项确认：字段名、类型、可空性、默认值  
- 将最终结果写回本文件  

**验收标准:**  
- 本文件契约与设计文档一致  
- 状态枚举已明确，不再出现 `draft`  

---

## Task 12.2: 后端 DTO/serde 对齐与响应重构

**状态:** ⬜ 未开始

**目标:**  
后端 API 输出完全符合契约，不再暴露 `config` 或 snake_case 字段。

**涉及文件:**  
- 修改: `crates/server/src/routes/workflows.rs`  
- 新增(可选): `crates/server/src/routes/workflows_types.rs`  
- 修改: `crates/db/src/models/workflow.rs`  

**实施步骤:**  

Step 12.2.1: 定义 API DTO（不要使用 `#[serde(flatten)]`）  
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDetailDto {
    pub workflow: WorkflowDto,
    pub tasks: Vec<WorkflowTaskDto>,
    pub commands: Vec<WorkflowCommandDto>,
}
```

Step 12.2.2: 明确映射逻辑（从 DB 模型到 DTO）  
- 避免 `flatten` 防止字段冲突  
- 明确 `projectId`、`useSlashCommands` 等字段  

Step 12.2.3: 更新 routes 返回结构  
- `/api/workflows` 返回列表 DTO  
- `/api/workflows/:id` 返回详情 DTO  

**验收标准:**  
- API JSON 全部为 camelCase  
- 响应结构与契约一致  

---

## Task 12.3: 生成类型对齐（generate_types / shared/types.ts）

**状态:** ⬜ 未开始

**目标:**  
共享类型与后端保持一致，前端只依赖生成类型。

**涉及文件:**  
- 修改: `crates/server/src/bin/generate_types.rs`  
- 生成: `shared/types.ts`  

**实施步骤:**  

Step 12.3.1: 更新类型输出范围  
- 移除 `SharedTask` 与 `remote` 相关残留  
- 加入新的 Workflow DTO 类型  

Step 12.3.2: 生成类型并校验  
```
pnpm run generate-types
pnpm run generate-types:check
```

Step 12.3.3: 检查是否有旧字段残留  
```
rg -n "config: WorkflowConfig|project_id" shared/types.ts
```

**验收标准:**  
- `shared/types.ts` 与契约一致  
- 不再出现 `config` 或 snake_case 字段  

---

## Task 12.4: 前端 hooks/types 对齐（useWorkflows 等）

**状态:** ⬜ 未开始

**目标:**  
前端只使用新契约字段，避免解析错误。

**涉及文件:**  
- 修改: `frontend/src/hooks/useWorkflows.ts`  
- 修改: `frontend/src/pages/Workflows.tsx`  
- 修改: `frontend/src/pages/WorkflowDebug.tsx`  

**实施步骤:**  

Step 12.4.1: 替换前端 Workflow 类型为共享类型  
- 直接 import `shared/types.ts`  
- 删除自定义 `WorkflowConfig`  

Step 12.4.2: 修正字段命名  
- `project_id` -> `projectId`  
- `created_at` -> `createdAt`  

Step 12.4.3: 移除 `config` 相关逻辑  
- `workflow.config.*` 全部改为 `workflow.tasks/commands`  

**验收标准:**  
- TypeScript 编译通过  
- 前端不再读取 `config`  

---

## Task 12.5: 状态枚举统一与映射修复

**状态:** ⬜ 未开始

**目标:**  
前后端状态完全一致，避免 UI 错乱。

**涉及文件:**  
- 修改: `frontend/src/pages/Workflows.tsx`  
- 修改: `frontend/src/pages/WorkflowDebug.tsx`  
- 修改: `shared/types.ts`  

**实施步骤:**  

Step 12.5.1: 新增统一状态类型  
- `WorkflowStatus` 直接来自 `shared/types.ts`  

Step 12.5.2: 更新 UI 显示与映射  
- `created` -> “待配置”  
- `ready` -> “就绪”  

Step 12.5.3: 移除 `draft`、`idle` 等非标准状态  

**验收标准:**  
- UI 状态与后端完全一致  

---

## Task 12.6: 契约测试与回归验证（API + 前端）

**状态:** ⬜ 未开始

**目标:**  
测试锁定契约，防止回归。

**涉及文件:**  
- 新增: `tests/e2e/workflow_contract_test.rs`  
- 修改: `frontend/src/hooks/__tests__/useWorkflows.test.tsx`  

**实施步骤:**  

Step 12.6.1: 编写 API 合约测试  
- 验证字段存在且为 camelCase  
- 验证状态枚举只允许规定值  

Step 12.6.2: 前端解析测试  
- 提供 mock JSON  
- 确保 hook 能正确解析  

Step 12.6.3: 运行测试  
```
cargo test --workspace
pnpm test -- --run
```

**验收标准:**  
- 合约测试通过  
- 前端解析无错误  
