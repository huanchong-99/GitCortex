# GitCortex 开发进度追踪

> **自动化说明:** 此文件由 `superpowers-automation` skill 自动更新。
> 每完成一个任务，对应行的状态会从 `⬜` 更新为 `✅` 并记录完成时间。

## 总体进度

| 指标 | 值 |
|------|-----|
| 总任务数 | 32 |
| 已完成 | 2 |
| 进行中 | 0 |
| 未开始 | 30 |
| **完成率** | **6.25%** |

---

## Phase 0: 项目文档重写 ✅

**计划文件:** `01-phase-0-docs.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 0.1 | LICENSE 文件 - 基于 MIT 协议，声明二开来源 | ✅ | 2026-01-16 |
| 0.2 | README.md 文件 - GitCortex 项目说明文档 | ✅ | 2026-01-16 |

---

## Phase 1: 数据库模型扩展 ⬜

**计划文件:** `02-phase-1-database.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 1.1 | 创建 Workflow 数据库迁移文件 - 9张表的 DDL + 系统内置数据 | ⬜ | - |
| 1.2 | 创建 Workflow Rust 模型 - cli_type.rs, workflow.rs, terminal.rs | ⬜ | - |
| 1.3 | 创建数据库访问层 (DAO) - workflows_dao.rs, cli_types_dao.rs | ⬜ | - |
| 1.4 | 创建 API 路由 - workflows.rs, cli_types.rs 路由文件 | ⬜ | - |

---

## Phase 2: CC-Switch 核心提取与集成 ⬜

**计划文件:** `03-phase-2-cc-switch.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 2.1 | 分析 CC-Switch 核心代码 - 确定可提取模块和依赖关系 | ⬜ | - |
| 2.2 | 创建 cc-switch crate - 在 workspace 中创建独立 crate | ⬜ | - |
| 2.3 | 实现原子写入和配置读写 - Claude/Codex/Gemini 配置文件操作 | ⬜ | - |
| 2.4 | 实现模型切换服务 - 统一的 ModelSwitcher 接口 | ⬜ | - |
| 2.5 | 集成 cc-switch 到 services - CCSwitchService 封装 | ⬜ | - |

---

## Phase 3: Orchestrator 主 Agent 实现 ⬜

**计划文件:** `04-phase-3-orchestrator.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 3.1 | 创建 Orchestrator 模块结构 - mod.rs 和目录结构 | ⬜ | - |
| 3.2 | 实现 LLM 客户端抽象 - OpenAI 兼容 API 客户端 | ⬜ | - |
| 3.3 | 实现消息总线 - 跨终端消息路由 MessageBus | ⬜ | - |
| 3.4 | 实现 OrchestratorAgent - 主协调 Agent 核心逻辑 | ⬜ | - |

---

## Phase 4: 终端管理与启动机制 ⬜

**计划文件:** `05-phase-4-terminal.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 4.1 | 实现 TerminalLauncher - 终端进程启动器 | ⬜ | - |
| 4.2 | 实现进程管理 - TerminalProcess 生命周期管理 | ⬜ | - |
| 4.3 | 实现 CLI 检测服务 - 检测已安装的 CLI 工具 | ⬜ | - |

---

## Phase 5: Git 事件驱动系统 ⬜

**计划文件:** `06-phase-5-git-watcher.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 5.1 | 实现 GitWatcher - 监听 .git/refs/heads 目录变化 | ⬜ | - |
| 5.2 | 实现提交信息解析器 - 解析 commit message 中的状态标记 | ⬜ | - |
| 5.3 | 连接 Git 事件到 Orchestrator - GitEventHandler 处理器 | ⬜ | - |

---

## Phase 6: 前端界面改造 (7步向导) ⬜

**计划文件:** `07-phase-6-frontend.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 6.1 | 创建向导框架和类型定义 - types.ts, WorkflowWizard.tsx, StepIndicator.tsx | ⬜ | - |
| 6.2 | 步骤 0-1 组件 - Step0Project.tsx (工作目录), Step1Basic.tsx (基础配置) | ⬜ | - |
| 6.3 | 步骤 2-3 组件 - Step2Tasks.tsx (任务配置), Step3Models.tsx (模型配置) | ⬜ | - |
| 6.4 | 步骤 4-6 组件 - Step4Terminals, Step5Commands, Step6Advanced | ⬜ | - |
| 6.5 | 创建流水线视图 - PipelineView.tsx, TerminalCard.tsx, API Hooks | ⬜ | - |

---

## Phase 7: 终端调试视图 ⬜

**计划文件:** `08-phase-7-terminal-debug.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 7.1 | 集成 xterm.js - 安装依赖，创建 TerminalEmulator.tsx | ⬜ | - |
| 7.2 | 实现 PTY WebSocket 后端 - terminal_ws.rs 路由 | ⬜ | - |
| 7.3 | 创建终端调试页面 - TerminalDebugView.tsx, WorkflowDebug.tsx | ⬜ | - |

---

## Phase 8: 集成测试与文档 ⬜

**计划文件:** `09-phase-8-testing.md`

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 8.1 | 端到端测试 - workflow_test.rs 完整流程测试 | ⬜ | - |
| 8.2 | 性能优化 - 数据库查询和 WebSocket 连接优化 | ⬜ | - |
| 8.3 | 用户文档 - 更新 README 和使用指南 | ⬜ | - |

---

## 状态说明

| 状态 | 含义 |
|------|------|
| ✅ | 已完成 |
| 🔄 | 进行中 |
| ⬜ | 未开始 |
| ❌ | 阻塞/失败 |

---

## 自动化触发记录

> 每次 skill 触发时记录，用于追踪自我续航

| 触发时间 | 触发原因 | 开始任务 | 结束任务 |
|----------|----------|----------|----------|
| 2026-01-17 | 初始设置完成 | - | 计划拆分完成 |
