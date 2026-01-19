# GitCortex 开发进度追踪

> **自动化说明:** 此文件由 `superpowers-automation` skill 自动更新。
> 每完成一个任务，对应行的状态会从 `⬜` 更新为 `✅` 并记录完成时间。

## 总体进度

| 指标 | 值 |
|------|-----|
| 总任务数 | 51 |
| 已完成 | 43 |
| 进行中 | 0 |
| 未开始 | 8 |
| **完成率** | **84.31%** |

---

## Phase 0: 项目文档重写 ✅

**计划文件:** `01-phase-0-docs.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 0.1 | LICENSE 文件 - 基于 MIT 协议，声明二开来源 | ✅ | 2026-01-16 |
| 0.2 | README.md 文件 - GitCortex 项目说明文档 | ✅ | 2026-01-16 |

---

## Phase 1: 数据库模型扩展 ✅

**计划文件:** `02-phase-1-database.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 1.1 | 创建 Workflow 数据库迁移文件 - 9张表的 DDL + 系统内置数据 | ✅ | 2026-01-17 |
| 1.2 | 创建 Workflow Rust 模型 - cli_type.rs, workflow.rs, terminal.rs | ✅ | 2026-01-17 |
| 1.3 | 创建数据库访问层 (DAO) - workflows_dao.rs, cli_types_dao.rs | ✅ | 2026-01-17 |
| 1.4 | 创建 API 路由 - workflows.rs, cli_types.rs 路由文件 | ✅ | 2026-01-17 |

---

## Phase 2: CC-Switch 核心提取与集成 ✅

**计划文件:** `03-phase-2-cc-switch.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 2.1 | 分析 CC-Switch 核心代码 - 确定可提取模块和依赖关系 | ✅ | 2026-01-17 |
| 2.2 | 创建 cc-switch crate - 在 workspace 中创建独立 crate | ✅ | 2026-01-17 |
| 2.3 | 实现原子写入和配置读写 - Claude/Codex/Gemini 配置文件操作 | ✅ | 2026-01-17 |
| 2.4 | 实现模型切换服务 - 统一的 ModelSwitcher 接口 | ✅ | 2026-01-17 |
| 2.5 | 集成 cc-switch 到 services - CCSwitchService 封装 | ✅ | 2026-01-17 |

---

## Phase 3: Orchestrator 主 Agent 实现 ✅

**计划文件:** `04-phase-3-orchestrator.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 3.1 | 创建 Orchestrator 模块结构 - mod.rs 和目录结构 | ✅ | 2026-01-18 |
| 3.2 | 实现 LLM 客户端抽象 - OpenAI 兼容 API 客户端 | ✅ | 2026-01-18 |
| 3.3 | 实现消息总线 - 跨终端消息路由 MessageBus | ✅ | 2026-01-18 |
| 3.4 | 实现 OrchestratorAgent - 主协调 Agent 核心逻辑 | ✅ | 2026-01-18 |
| 3.5 | 修复测试遗留问题 - 实现 MockLLMClient 和完整测试 | ✅ | 2026-01-18 |

---

## Phase 4: 终端管理与启动机制 ✅

**计划文件:** `05-phase-4-terminal.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 4.1 | 实现 TerminalLauncher - 终端进程启动器 | ✅ | 2026-01-18 |
| 4.2 | 实现进程管理 - TerminalProcess 生命周期管理 | ✅ | 2026-01-18 |
| 4.3 | 实现 CLI 检测服务 - 检测已安装的 CLI 工具 | ✅ | 2026-01-18 |

---

## Phase 5: Git 事件驱动系统 ✅

**计划文件:** `06-phase-5-git-watcher.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 5.1 | 实现 GitWatcher - 监听 .git/refs/heads 目录变化 | ✅ | 2024-01-18 |
| 5.2 | 实现提交信息解析器 - 解析 commit message 中的状态标记 | ✅ | 2024-01-18 |
| 5.3 | 连接 Git 事件到 Orchestrator - GitEventHandler 处理器 | ✅ | 2024-01-18 |

---

## Phase 6: 前端界面改造 (7步向导) ✅

**计划文件:** `07-phase-6-frontend.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 6.1 | 创建向导框架和类型定义 - types.ts, WorkflowWizard.tsx, StepIndicator.tsx | ✅ | 2026-01-18 |
| 6.2 | 步骤 0-1 组件 - Step0Project.tsx (工作目录), Step1Basic.tsx (基础配置) | ✅ | 2026-01-18 |
| 6.3 | 步骤 2-3 组件 - Step2Tasks.tsx (任务配置), Step3Models.tsx (模型配置) | ✅ | 2026-01-18 |
| 6.4 | 步骤 4-6 组件 - Step4Terminals, Step5Commands, Step6Advanced | ✅ | 2026-01-18 |
| 6.5 | 创建流水线视图 - PipelineView.tsx, TerminalCard.tsx, API Hooks | ✅ | 2026-01-18 |

---

## Phase 7: 终端调试视图 ✅

**计划文件:** `08-phase-7-terminal-debug.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 7.1 | 集成 xterm.js - 安装依赖，创建 TerminalEmulator.tsx | ✅ | 2026-01-19 |
| 7.2 | 实现 PTY WebSocket 后端 - terminal_ws.rs 路由 | ✅ | 2026-01-19 |
| 7.3 | 创建终端调试页面 - TerminalDebugView.tsx, WorkflowDebug.tsx | ✅ | 2026-01-19 |

---

## Phase 8.5: 代码质量修复 (审计后新增) ✅

**计划文件:** `09-phase-8.5-code-quality-fix.md`

> **说明:** 此 Phase 为 2026-01-19 代码审计后新增，已全部完成。

### P0 - 严重问题修复 (生产环境阻塞)

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 8.5.1 | 实现 execute_instruction 核心逻辑 - 移除 TODO 占位符 | ✅ | 2026-01-19 |
| 8.5.2 | API Key 加密存储 - 使用 AES-256-GCM 加密敏感字段 | ✅ | 2026-01-19 |
| 8.5.3 | 实现 handle_git_event 实际逻辑 - Git 事件到终端完成事件转换 | ✅ | 2026-01-19 |

### P1 - 代码清理

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 8.5.4 | 移除未使用的导入 - 清理 7 个编译警告 | ✅ | 2026-01-19 |
| 8.5.5 | 移除/使用未使用的 db 字段 - OrchestratorAgent.dead_code | ✅ | 2026-01-19 |
| 8.5.6 | 统一命名规范 - Rust snake_case, TypeScript camelCase, serde rename_all | ✅ | 2026-01-19 |
| 8.5.7 | 添加错误重试机制 - LLM 请求网络错误重试 (最多3次) | ✅ | 2026-01-19 |

### P2 - 代码重构

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 8.5.8 | 重构魔法数字 - MAX_HISTORY 等改为可配置项 | ✅ | 2026-01-19 |
| 8.5.9 | 重构硬编码字符串 - 提取常量 (WORKFLOW_TOPIC_PREFIX 等) | ✅ | 2026-01-19 |
| 8.5.10 | 完善状态机转换 - 显式状态转换，验证合法性 | ✅ | 2026-01-19 |
| 8.5.11 | LLM 提示词模板化 - 使用 Handlebars 模板引擎 | ✅ | 2026-01-19 |
| 8.5.12 | 数据库批量操作优化 - 使用事务批量插入 | ✅ | 2026-01-19 |
| 8.5.13 | WebSocket 终端连接超时控制 | ✅ | 2026-01-19 |

---

## Phase 8: 集成测试与文档 ⬜

**计划文件:** `09-phase-8-testing.md`

> **前置条件:** Phase 8.5 代码质量修复完成

### 原有任务

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 8.1 | 端到端测试 - workflow_test.rs 完整流程测试 | ⬜ | - |
| 8.2 | 性能优化 - 数据库查询和 WebSocket 连接优化 | ⬜ | - |
| 8.3 | 用户文档 - 更新 README 和使用指南 | ⬜ | - |

---

## 代码规范 (后续开发强制遵守)

> **来源:** 2026-01-19 代码审计报告

### A. 命名规范

| 语言 | 命名风格 | 示例 |
|------|----------|------|
| **Rust 结构体/枚举** | PascalCase | `Workflow`, `TerminalStatus` |
| **Rust 字段/变量** | snake_case | `cli_type_id`, `order_index` |
| **Rust 常量** | SCREAMING_SNAKE_CASE | `MAX_HISTORY`, `WORKFLOW_TOPIC_PREFIX` |
| **TypeScript 类型/接口** | PascalCase | `Workflow`, `TerminalConfig` |
| **TypeScript 字段** | camelCase | `cliTypeId`, `orderIndex` |
| **数据库列名** | snake_case | `orchestrator_api_key`, `workflow_task_id` |
| **API JSON 响应** | camelCase | `cliTypeId`, `orchestratorApiKey` |

**Rust Serde 配置模板:**
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // API 响应统一使用 camelCase
pub struct Workflow {
    pub workflow_id: String,
    pub cli_type_id: String,
    // ...
}
```

### B. 禁止硬编码

**错误示例:**
```rust
// ❌ 硬编码
let topic = format!("workflow:{}", id);
const MAX_HISTORY: usize = 50;
```

**正确示例:**
```rust
// ✅ 可配置
pub const WORKFLOW_TOPIC_PREFIX: &str = "workflow:";
pub const DEFAULT_MAX_HISTORY: usize = 50;

#[derive(Debug, Clone)]
pub struct OrchestratorConfig {
    pub max_conversation_history: usize,
    pub llm_timeout_secs: u64,
}
```

### C. 错误处理规范

**网络请求必须有重试:**
```rust
async fn request_with_retry<T>(
    f: impl Fn() -> impl Future<Output = anyhow::Result<T>>,
) -> anyhow::Result<T> {
    let max_retries = 3;
    for attempt in 0..max_retries {
        match f().await {
            Ok(result) => return Ok(result),
            Err(e) if attempt < max_retries - 1 => {
                tokio::time::sleep(Duration::from_millis(1000 * (attempt + 1) as u64)).await;
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}
```

### D. 敏感信息加密

**API Key/Token 必须加密存储:**
```rust
// 使用 aes-gcm 加密
pub orchestrator_api_key_encrypted: Option<String>,

// 提供加密/解密方法
impl Workflow {
    pub fn set_api_key(&mut self, plaintext: &str, key: &[u8; 32]) -> anyhow::Result<()>;
    pub fn get_api_key(&self, key: &[u8; 32]) -> anyhow::Result<Option<String>>;
}
```

### E. 状态机规范

**状态转换必须显式验证:**
```rust
impl OrchestratorState {
    pub fn transition_to(&mut self, new_state: State) -> anyhow::Result<()> {
        match (self.current, new_state) {
            (State::Idle, State::Processing) => { /* valid */ }
            (State::Processing, State::Idle) => { /* valid */ }
            (from, to) => return Err(anyhow!("Invalid transition: {:?} → {:?}", from, to)),
        }
        self.current = new_state;
        Ok(())
    }
}
```

### F. 数据库操作规范

**批量操作使用事务:**
```rust
pub async fn create_workflow_with_tasks(
    pool: &SqlitePool,
    workflow: &Workflow,
    tasks: Vec<Task>,
) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;
    sqlx::query("INSERT INTO workflow ...").execute(&mut *tx).await?;
    for task in tasks {
        sqlx::query("INSERT INTO task ...").execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}
```

---

## 状态说明

| 状态 | 含义 |
|------|------|
| ✅ | 已完成 |
| 🔄 | 进行中 |
| ⬜ | 未开始 |
| ❌ | 阻塞/失败 |
| 🚨 | **紧急修复** |

---

## 自动化触发记录

> 每次 skill 触发时记录，用于追踪自我续航

| 触发时间 | 触发原因 | 开始任务 | 结束任务 |
|----------|----------|----------|----------|
| 2026-01-17 | 初始设置完成 | - | 计划拆分完成 |
| 2026-01-17 | Phase 1 Database 完成 | Task 1.1-1.4 | 4/4 任务完成 |
| 2026-01-17 | Phase 2 CC-Switch 完成 | Task 2.1-2.5 | 5/5 任务完成 |
| 2026-01-18 | Phase 3 Orchestrator 完成 | Task 3.1-3.4 | 4/4 任务完成 (22个测试通过) |
| 2026-01-18 | Phase 4 Terminal 完成 | Task 4.1-4.3 | 3/3 任务完成 + 集成测试 |
| 2026-01-18 | Phase 3 测试遗留问题修复 | Task 3.5 (新增) | 添加 MockLLMClient，完整测试实现 |
| 2024-01-18 | Phase 5 Git Watcher 完成 | Task 5.1-5.3 | 3/3 任务完成 + 12个测试通过 + 使用文档 |
| 2026-01-18 | Phase 6 Frontend 完成 | Task 6.1-6.5 | 5/5 任务完成 + 180个测试通过 + 路由集成 |
| 2026-01-19 | Phase 7 Terminal Debug 完成 | Task 7.1-7.3 | 3/3 任务完成 + xterm.js 集成 + WebSocket 后端 + 调试页面 |
| 2026-01-19 | **代码审计完成** | - | 发现 C 级代码质量问题，新增 Phase 8.5 |
| 2026-01-19 | **Phase 8.5 代码质量修复完成** | Task 8.5.1-8.5.13 | 13/13 任务完成 + 分支合并 + WebSocket超时控制 |
