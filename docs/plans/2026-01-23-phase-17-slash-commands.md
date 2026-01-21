# Phase 17: 斜杠命令系统与提示词执行（详细实施计划）

> **状态:** ⬜ 未开始  
> **进度追踪:** 查看 `TODO.md`  
> **前置条件:** Phase 16 完成  

## 目标

1. 斜杠命令预设可管理（CRUD）。  
2. Workflow 绑定命令可排序、可配置参数。  
3. Orchestrator 可渲染模板并执行。  

## 参考资料

- `crates/db/src/models/workflow.rs`（SlashCommandPreset）  
- `crates/services/src/services/orchestrator/llm.rs`  

---

## 新手准备清单

1) 了解什么是“命令模板”：  
模板 + 参数 -> 最终提示词  

2) 了解 Handlebars：  
渲染模板与变量替换  

---

## Task 17.1: 斜杠命令预设 CRUD（后端）

**状态:** ⬜ 未开始  

**目标:**  
提供命令预设的完整 API。

**涉及文件:**  
- 新增: `crates/server/src/routes/slash_commands.rs`  
- 修改: `crates/server/src/routes/mod.rs`  

**实施步骤（新手可逐步照做）:**  

Step 17.1.1: 新建 REST API  
- GET /api/commands  
- POST /api/commands  
- PUT /api/commands/:id  
- DELETE /api/commands/:id  

Step 17.1.2: 输入校验  
- command 必须以 `/` 开头  
- command 唯一  
- description 必填  

Step 17.1.3: 添加测试  
- 创建 -> 查询 -> 更新 -> 删除  

**验收标准:**  
- CRUD 全流程可用  

---

## Task 17.2: 前端斜杠命令管理与选择

**状态:** ⬜ 未开始  

**目标:**  
用户可在 UI 管理命令预设并选择。

**涉及文件:**  
- 新增: `frontend/src/pages/SlashCommands.tsx`  
- 修改: `frontend/src/components/workflow/steps/Step5Commands.tsx`  

**实施步骤（新手可逐步照做）:**  

Step 17.2.1: 命令管理页面  
- 列表 + 新增/编辑/删除  

Step 17.2.2: 向导选择  
- 多选  
- 拖拽排序  

Step 17.2.3: 保存到创建请求  

**验收标准:**  
- 命令可管理并绑定 workflow  

---

## Task 17.3: WorkflowCommand 关联排序与参数编辑

**状态:** ⬜ 未开始  

**目标:**  
支持顺序与自定义参数。

**涉及文件:**  
- 修改: `frontend/src/components/workflow/steps/Step5Commands.tsx`  
- 修改: `crates/server/src/routes/workflows.rs`  

**实施步骤（新手可逐步照做）:**  

Step 17.3.1: 前端参数编辑  
- JSON 格式校验  

Step 17.3.2: 后端存储  
- workflow_command.custom_params  

Step 17.3.3: 返回排序结果  

**验收标准:**  
- 参数可保存并回显  

---

## Task 17.4: Orchestrator 提示词渲染与命令执行

**状态:** ⬜ 未开始  

**目标:**  
把模板渲染为真实提示词并发送给 LLM。

**涉及文件:**  
- 修改: `crates/services/src/services/orchestrator/agent.rs`  
- 修改: `crates/services/src/services/orchestrator/llm.rs`  

**实施步骤（新手可逐步照做）:**  

Step 17.4.1: 渲染模板  
- 使用 Handlebars  
- 参数缺失报错  

Step 17.4.2: 发送 LLM 请求  
- 使用现有 LLM client  

Step 17.4.3: 记录执行日志  
- 保存 prompt 与响应摘要  

**验收标准:**  
- 命令可执行并产出结果  

---

## Task 17.5: 命令系统测试与回归

**状态:** ⬜ 未开始  

**目标:**  
确保命令功能稳定。

**涉及文件:**  
- 新增: `crates/services/tests/slash_command_test.rs`  
- 修改: `frontend/src/components/workflow/steps/Step5Commands.test.tsx`  

**实施步骤（新手可逐步照做）:**  

Step 17.5.1: 后端测试  
- 渲染模板  
- 校验输出  

Step 17.5.2: 前端测试  
- 排序 + 参数编辑  

Step 17.5.3: 运行测试  
```
cargo test --workspace
pnpm test -- --run
```

**验收标准:**  
- 测试稳定通过  
