# Phase 13: Workflow 创建与持久化（详细实施计划）

> **状态:** ⬜ 未开始  
> **进度追踪:** 查看 `TODO.md`  
> **前置条件:** Phase 12 完成  

## 目标

1. `POST /api/workflows` 支持创建完整 workflow（含 tasks/terminals/commands）。  
2. 所有写入走单事务，失败即回滚。  
3. `GET /api/workflows/:id` 返回完整结构（前端可直接渲染）。  

## 非目标

- 不启动 Orchestrator（Phase 14）。  
- 不处理前端 UI（Phase 16）。  

## 参考资料（先读）

- `docs/plans/2026-01-16-orchestrator-design.md`（状态与数据模型）  
- `crates/db/src/models/workflow.rs`（DB 模型与 DAO）  
- `crates/server/src/routes/workflows.rs`（现有 API）  

---

## 新手准备清单

1) 设置加密 key（否则创建 workflow 会失败）：  
```
$env:GITCORTEX_ENCRYPTION_KEY="12345678901234567890123456789012"
```

2) 熟悉 4 张关键表：  
- workflow  
- workflow_task  
- terminal  
- workflow_command  

3) 跑一次类型生成脚本（确认可用）：  
```
pnpm run generate-types
```

---

## Task 13.1: 设计并实现 CreateWorkflowRequest（含 tasks/terminals）

**状态:** ⬜ 未开始  

**目标:**  
CreateWorkflowRequest 支持完整任务与终端结构，并具备基础输入校验。

**涉及文件:**  
- 修改: `crates/db/src/models/workflow.rs`  
- 修改: `crates/server/src/routes/workflows.rs`  
- 生成: `shared/types.ts`  

**实施步骤（新手可逐步照做）:**  

Step 13.1.1: 在 `workflow.rs` 找到 `CreateWorkflowRequest`  
- 把结构体放在 `CreateWorkflowRequest` 上方  
- 新增 2 个请求结构体：`CreateWorkflowTaskRequest`、`CreateTerminalRequest`  

Step 13.1.2: 结构体字段（建议模板）  
```rust
#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkflowTaskRequest {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub branch: Option<String>,
    pub order_index: i32,
    pub terminals: Vec<CreateTerminalRequest>,
}

#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct CreateTerminalRequest {
    pub id: Option<String>,
    pub cli_type_id: String,
    pub model_config_id: String,
    pub custom_base_url: Option<String>,
    pub custom_api_key: Option<String>,
    pub role: Option<String>,
    pub role_description: Option<String>,
    pub order_index: i32,
}
```
**最佳实践:**  
- Request 类型不要直接复用 DB 模型。  
- `id` 允许为空，后端生成更安全。  

Step 13.1.3: 把 `tasks` 加入 CreateWorkflowRequest  
```rust
pub struct CreateWorkflowRequest {
    // ...
    pub tasks: Vec<CreateWorkflowTaskRequest>,
    pub commands: Option<Vec<CreateWorkflowCommandRequest>>,
}
```

Step 13.1.4: 增加输入校验函数  
在 `workflows.rs` 中新增：  
```rust
fn validate_create_request(req: &CreateWorkflowRequest) -> Result<(), ApiError> {
    if req.project_id.trim().is_empty() {
        return Err(ApiError::BadRequest("projectId is required".to_string()));
    }
    if req.tasks.is_empty() {
        return Err(ApiError::BadRequest("tasks must not be empty".to_string()));
    }
    // 校验任务与终端
    for (task_index, task) in req.tasks.iter().enumerate() {
        if task.name.trim().is_empty() {
            return Err(ApiError::BadRequest(format!("task[{}].name is required", task_index)));
        }
        if task.terminals.is_empty() {
            return Err(ApiError::BadRequest(format!("task[{}].terminals must not be empty", task_index)));
        }
    }
    Ok(())
}
```

Step 13.1.5: 运行格式化与类型生成  
```
cargo fmt
pnpm run generate-types
```

**验收标准:**  
- CreateWorkflowRequest 包含 tasks/terminals  
- 不合法输入返回清晰错误  

**常见错误与排查:**  
- 错误: `missing field tasks`  
  - 原因: 前端没传或后端结构未更新  
  - 解决: 确认 `CreateWorkflowRequest` 是否包含 `tasks`  

---

## Task 13.2: 使用事务创建 workflow + tasks + terminals

**状态:** ⬜ 未开始  

**目标:**  
通过单事务写入 workflow、workflow_task、terminal。

**涉及文件:**  
- 修改: `crates/server/src/routes/workflows.rs`  
- 使用: `crates/db/src/models/workflow.rs::create_with_tasks`  

**实施步骤（新手可逐步照做）:**  

Step 13.2.1: 创建 workflow 基础对象  
- `workflow_id = Uuid::new_v4().to_string()`  
- `status = "created"`  
- `created_at/updated_at = Utc::now()`  

Step 13.2.2: 构造 tasks 与 terminals  
每个 task/terminal 设置默认状态：  
- task.status = `"pending"`  
- terminal.status = `"not_started"`  

Step 13.2.3: 调用 `create_with_tasks`  
```rust
Workflow::create_with_tasks(&pool, &workflow, task_rows).await?;
```

Step 13.2.4: 返回完整详情  
- 创建后再查询 tasks + terminals  
- 组装为 `WorkflowDetailResponse` 返回  

**验收标准:**  
- 事务失败时不会残留部分数据  
- detail API 返回完整结构  

**常见错误与排查:**  
- 错误: workflow 已创建但 task 不存在  
  - 原因: 没使用 `create_with_tasks`  
  - 解决: 全部写入必须走单事务  

---

## Task 13.3: 分支命名与冲突策略

**状态:** ⬜ 未开始  

**目标:**  
每个 task 拥有稳定且唯一的分支名。

**涉及文件:**  
- 修改: `crates/services/src/services/git.rs`  
- 修改: `crates/server/src/routes/workflows.rs`  

**实施步骤（新手可逐步照做）:**  

Step 13.3.1: 设计命名规则  
```
workflow/{workflow_id}/{task_slug}
```

Step 13.3.2: 实现 `slugify`  
- 小写  
- 空格替换为 `-`  
- 移除特殊字符  

Step 13.3.3: 检查冲突  
- 若分支已存在，追加 `-2`, `-3`  

**验收标准:**  
- 同一 workflow 内分支名无冲突  

---

## Task 13.4: CLI/模型配置校验

**状态:** ⬜ 未开始  

**目标:**  
避免无效 CLI 或模型导致运行期崩溃。

**涉及文件:**  
- 修改: `crates/server/src/routes/workflows.rs`  
- 修改: `crates/db/src/models/cli_type.rs`  
- 修改: `crates/db/src/models/model_config.rs`  

**实施步骤（新手可逐步照做）:**  

Step 13.4.1: 校验 CLI 是否存在  
```rust
let cli = CliType::find_by_id(&pool, &cli_type_id).await?;
```

Step 13.4.2: 校验模型是否存在  
```rust
let model = ModelConfig::find_by_id(&pool, &model_config_id).await?;
```

Step 13.4.3: 校验模型与 CLI 的归属  
- `model.cli_type_id == cli.id`  

**验收标准:**  
- 无效配置会被拒绝并返回明确错误  

---

## Task 13.5: WorkflowCommand 关联与自定义参数

**状态:** ⬜ 未开始  

**目标:**  
命令可排序并支持 `customParams`。

**涉及文件:**  
- 修改: `crates/server/src/routes/workflows.rs`  
- 修改: `crates/db/src/models/workflow.rs`  

**实施步骤（新手可逐步照做）:**  

Step 13.5.1: 在请求中支持 `commands`  
```json
"commands": [
  { "presetId": "cmd-write-code", "orderIndex": 0, "customParams": "{\"tone\":\"strict\"}" }
]
```

Step 13.5.2: 校验 preset 存在  
如果不存在，返回 400。  

Step 13.5.3: 写入 workflow_command  
- 按 orderIndex 排序写入  

**验收标准:**  
- 命令顺序可持久化  
- customParams 原样存储  

---

## Task 13.6: Workflow Detail/List 返回完整结构

**状态:** ⬜ 未开始  

**目标:**  
前端无需 `config` 即可渲染。

**涉及文件:**  
- 修改: `crates/server/src/routes/workflows.rs`  

**实施步骤（新手可逐步照做）:**  

Step 13.6.1: detail API 返回 tasks/terminals/commands  
- tasks 按 `order_index` 排序  
- terminals 按 `order_index` 排序  

Step 13.6.2: list API 返回轻量结构  
- 只返回 workflow 基本字段  
- 可附加 `tasksCount`  

**验收标准:**  
- 前端可直接渲染列表与详情  

---

## Task 13.7: API 集成测试与回滚验证

**状态:** ⬜ 未开始  

**目标:**  
确保创建流程可靠。

**涉及文件:**  
- 新增: `tests/e2e/workflow_create_test.rs`  

**实施步骤（新手可逐步照做）:**  

Step 13.7.1: 写入完整请求并断言  
- workflow 1 行  
- tasks N 行  
- terminals M 行  

Step 13.7.2: 写入非法请求并断言  
- 期望 400  
- DB 无新增数据  

Step 13.7.3: 运行测试  
```
cargo test --workspace
```

**验收标准:**  
- 正常与异常路径均通过  
