# 主 Agent 跨终端任务协调核心设计文档

## 概述

本文档描述了 GitCortex（基于 Vibe Kanban）的主 Agent 跨终端任务协调核心的设计方案，实现多 AI 模型的跨终端协同工作流。

## 目录

1. [核心架构](#1-核心架构)
2. [启动机制与 cc-switch 集成](#2-启动机制与-cc-switch-集成)
3. [数据模型](#3-数据模型)
4. [斜杠命令系统](#4-斜杠命令系统)
5. [CLI 检测与验证机制](#5-cli-检测与验证机制)
6. [基于 Git 监测的事件驱动模式](#6-基于-git-监测的事件驱动模式)
7. [前端界面设计](#7-前端界面设计)
8. [终端调试视图](#8-终端调试视图)

---

## 1. 核心架构

### 1.1 新增核心概念

| 概念 | 说明 |
|------|------|
| **Orchestrator** | 主 Agent 协调器，AI 驱动的中央控制器 |
| **Workflow** | 工作流，包含多个并行任务 |
| **Pipeline** | 流水线，定义任务内多个终端的串行执行顺序 |
| **Terminal** | 终端，CLI 实例 + 模型配置的组合 |

### 1.2 多任务并行架构

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                              Orchestrator (主 Agent)                         ║
║              用户配置: API类型 + Base URL + API Key + 模型                   ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                         消息总线 (Message Bus)                       │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
║                                                                             ║
║  ┌──────────────────────────────────┐                                       ║
║  │  错误处理终端 (可选)              │                                       ║
║  │  CLI: 用户配置 | Model: 用户配置  │                                       ║
║  └──────────────────────────────────┘                                       ║
╚═══════════════════════════════════════════════════════════════════════════════╝
           │                         │                         │
           ▼                         ▼                         ▼
  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
  │  Task 1         │     │  Task 2         │     │  Task 3         │
  │  branch: login  │     │  branch: i18n   │     │  branch: theme  │
  │                 │     │                 │     │                 │
  │  T1 [串行]      │     │  TA [串行]      │     │  TX [串行]      │
  │  T2             │     │  TB             │     │  TY             │
  │  T3             │     │                 │     │                 │
  └─────────────────┘     └─────────────────┘     └─────────────────┘
           ║                         ║                         ║
           ╚═════════════════════════╩═════════════════════════╝
                            任务间并行执行
                                  │
                                  ▼
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                        全局合并终端 (Merge Terminal)                         │
  │                    CLI: 用户配置 | Model: 用户配置                           │
  └─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                              [ main ]
```

### 1.3 关键特性

| 特性 | 说明 |
|------|------|
| **任务间并行** | 多个 Task 同时执行，互不阻塞 |
| **任务内串行** | 每个 Task 内的 Terminal 按顺序执行 |
| **终端数量灵活** | 用户决定每个任务有几个终端 |
| **独立 Git 分支** | 每个 Task 有独立分支 |
| **主 Agent 协调** | 负责启动终端、传递信息、处理审核循环 |

---

## 2. 启动机制与 cc-switch 集成

### 2.1 cc-switch 工作原理

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           cc-switch 原理                                    │
│                                                                             │
│  1. cc-switch 修改系统全局环境变量                                           │
│  2. 终端启动时读取当前环境变量，确定使用的模型                                 │
│  3. 终端启动后，环境变量再修改也不影响已启动的终端                             │
│  4. 因此：所有终端必须在启动阶段串行启动（逐个切换环境变量 → 启动）             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 终端启动流程（串行启动，并行运行）

```
启动阶段 (串行):
═══════════════════════════════════════════════════════════════════════════════

T0: cc-switch → Model-A
    └── 启动 Terminal 1 ✓ 启动完成，等待中

T1: cc-switch → Model-B
    └── 启动 Terminal 2 ✓ 启动完成，等待中

T2: cc-switch → Model-C
    └── 启动 Terminal 3 ✓ 启动完成，等待中

... (所有终端)

═══════════════════════════════════════════════════════════════════════════════
所有终端启动完成，进入就绪状态，等待用户确认开始
═══════════════════════════════════════════════════════════════════════════════
```

### 2.3 终端配置

每个终端是 CLI + 模型的组合，完全由用户在分步向导中配置：

- 支持只使用一种 CLI，也支持使用多种 CLI
- cc-switch 支持在任意 CLI 内切换到任意兼容模型（包括非官方模型如 GLM）
- 同一个 CLI 可以启动多个终端实例，使用不同模型

---

## 3. 数据模型

### 3.1 数据库表结构

```sql
-- 工作流表
CREATE TABLE workflow (
    id                      UUID PRIMARY KEY,
    name                    TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'created',
    -- created, starting, ready, running, merging, completed, failed

    use_slash_commands      BOOLEAN DEFAULT FALSE,

    -- 主 Agent 配置
    orchestrator_api_type   TEXT,
    orchestrator_base_url   TEXT,
    orchestrator_api_key    TEXT,
    orchestrator_model      TEXT,

    -- 错误处理终端配置 (可选)
    error_terminal_enabled  BOOLEAN DEFAULT FALSE,
    error_terminal_cli      TEXT,
    error_terminal_model    TEXT,

    -- 合并终端配置
    merge_terminal_cli      TEXT NOT NULL,
    merge_terminal_model    TEXT NOT NULL,

    ready_at                DATETIME,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 斜杠命令预设表 (全局，长期存储)
CREATE TABLE slash_command_preset (
    id              UUID PRIMARY KEY,
    command         TEXT NOT NULL UNIQUE,
    description     TEXT NOT NULL,
    is_system       BOOLEAN DEFAULT FALSE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 工作流使用的斜杠命令
CREATE TABLE workflow_command (
    id              UUID PRIMARY KEY,
    workflow_id     UUID REFERENCES workflow(id),
    preset_id       UUID REFERENCES slash_command_preset(id),
    order_index     INTEGER NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务表
CREATE TABLE workflow_task (
    id              UUID PRIMARY KEY,
    workflow_id     UUID REFERENCES workflow(id),
    task_id         UUID REFERENCES task(id),
    name            TEXT NOT NULL,
    branch          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    order_index     INTEGER NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 终端表
CREATE TABLE terminal (
    id              UUID PRIMARY KEY,
    workflow_task_id UUID REFERENCES workflow_task(id),
    cli             TEXT NOT NULL,
    model           TEXT NOT NULL,
    role            TEXT,
    order_index     INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'not_started',
    -- not_started, waiting, working, completed, failed
    process_id      INTEGER,
    session_id      TEXT,
    started_at      DATETIME,
    completed_at    DATETIME,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CLI 类型表
CREATE TABLE cli_type (
    id                  UUID PRIMARY KEY,
    name                TEXT NOT NULL UNIQUE,
    display_name        TEXT NOT NULL,
    detect_command      TEXT NOT NULL,
    install_command     TEXT,
    install_guide_url   TEXT,
    is_system           BOOLEAN DEFAULT TRUE,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 模型配置表
CREATE TABLE model_config (
    id              UUID PRIMARY KEY,
    cli_type_id     UUID REFERENCES cli_type(id),
    name            TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    cc_switch_cmd   TEXT,
    is_official     BOOLEAN DEFAULT FALSE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(cli_type_id, name)
);
```

### 3.2 工作流生命周期

```
创建 ──→ 启动中 ──→ 就绪 ──→ 运行中 ──→ 合并中 ──→ 已完成
(created) (starting) (ready) (running) (merging) (completed)
                       │
                       │ 所有终端已启动
                       │ 等待用户确认开始
                       │ 用户可进入终端调试视图
```

---

## 4. 斜杠命令系统

### 4.1 使用方式

斜杠命令系统是**可选的**。用户可以：
- 配置斜杠命令：主 Agent 按命令顺序执行
- 不配置：主 Agent 自行决策

### 4.2 主 Agent 任务发布格式

```
/斜杠命令 具体要求

示例:
/write-code 实现用户登录页面，包含用户名密码输入框和登录按钮
/review 检查代码安全性，特别关注XSS和SQL注入风险
/fix-issues 修复审计发现的3个中等风险问题
```

### 4.3 预设系统

- 系统内置预设：/write-code, /review, /fix-issues, /test, /refactor, /document
- 用户自定义预设：可长期存储，跨工作流复用
- 在设置页面管理预设

---

## 5. CLI 检测与验证机制

### 5.1 程序启动时检测

- 检测方式：执行 `CLI --version` 或 `which/where` 命令
- 显示已安装和未安装的 CLI 列表
- 提供安装指南链接

### 5.2 分步向导中的验证

- CLI 选项必须齐全（显示所有支持的 CLI）
- 用户可以选择任何 CLI
- 如果选择了未安装的 CLI，显示警告并禁止进入下一步
- 提供安装命令和重新检测按钮

---

## 6. 基于 Git 监测的事件驱动模式

### 6.1 核心原则

```
✗ 错误方式 (轮询):
  主 Agent 每隔 N 秒检查终端状态 → 大量 token 消耗

✓ 正确方式 (事件驱动):
  Git 监测服务检测到提交 → 唤醒主 Agent → 主 Agent 处理

强制规则:
  每个终端完成任务后必须提交 Git，这是唯一的"完成信号"
```

### 6.2 Git 监测服务

- 监听方式：文件系统监听 (.git/refs/heads/) 或定期轻量检查
- 检测到提交后：解析提交信息 → 识别来源终端 → 生成事件 → 唤醒主 Agent
- 低资源消耗，无 AI 调用

### 6.3 强制 Git 提交规范

```
[Terminal:{terminal_id}] [Status:{status}] {summary}

{详细描述}

---METADATA---
workflow_id: {workflow_id}
task_id: {task_id}
terminal_order: {order}
cli: {cli_type}
model: {model}
status: {completed|review_pass|review_reject|failed}
severity: {minor|major} (如果是审核打回)
reviewed_terminal: {terminal_id} (如果是审核)
issues: [{...}] (如果是审核打回)
next_action: {continue|retry|merge}
```

### 6.4 主 Agent 事件处理

```
主 Agent 状态:
┌──────────┐     Git事件      ┌──────────┐    处理完成    ┌──────────┐
│  休眠中   │ ───────────────→ │  处理中   │ ─────────────→ │  休眠中   │
│ (无消耗)  │                  │ (消耗token)│               │ (无消耗)  │
└──────────┘                  └──────────┘               └──────────┘
```

### 6.5 Token 消耗对比

| 模式 | 消耗 |
|------|------|
| 轮询模式 | ~1,080,000 token/小时 |
| 事件驱动 | ~18,000 token/工作流 |
| **节省** | **98%+** |

---

## 7. 前端界面设计

### 7.1 三视图模式

| 视图 | 用途 |
|------|------|
| **看板视图** | 任务状态总览，类似原 Vibe Kanban |
| **流水线视图** | 终端执行流程，类似 CI/CD 流水线 |
| **终端调试视图** | 直接访问原生终端，验证配置 |

### 7.2 分步向导

```
步骤 1: 任务配置
├── 本次启动几个任务？
└── 每个任务的名称

步骤 2: 终端配置
├── 每个任务有几个终端？
└── 每个终端: CLI + 模型 + 角色
    (显示 CLI 安装状态，未安装则禁止下一步)

步骤 3: 工作流程命令 (可选)
├── 是否配置斜杠命令？
└── 选择/创建斜杠命令

步骤 4: 高级配置
├── 错误处理终端 (可选): CLI + 模型
├── 合并终端: CLI + 模型
└── 主 Agent 配置: API类型 + Base URL + API Key + 模型
```

---

## 8. 终端调试视图

### 8.1 设计目的

在所有终端启动完成后（就绪状态），用户可以进入终端调试视图：
- 验证环境配置是否正确
- 安装缺失的插件或斜杠命令
- 测试命令是否可用
- 确认就绪后点击"开始任务"

### 8.2 关键特性

| 特性 | 说明 |
|------|------|
| **完全可交互** | 真实的原生终端，不是模拟 |
| **可执行命令** | 用户可以执行任何命令，包括安装插件 |
| **主 Agent 休眠** | 此阶段主 Agent 不工作，零 token 消耗 |
| **不影响流程** | 用户操作不影响后续工作流执行 |

### 8.3 技术实现

- 前端：xterm.js 终端渲染器
- 后端：PTY (伪终端) + WebSocket
- 用户输入直接传递给 CLI 进程
- CLI 输出直接显示在 xterm.js

### 8.4 工作流程

```
所有终端启动完成
        │
        ▼
   ┌──────────┐
   │ 就绪状态  │
   └────┬─────┘
        │
   ┌────┴────┐
   ▼         ▼
直接开始   进入终端调试
   │         │
   │         ▼
   │    用户在终端中:
   │    • 验证环境
   │    • 安装插件
   │    • 测试命令
   │         │
   │         │ 确认就绪
   │         ▼
   │    点击"开始任务"
   │         │
   └────┬────┘
        │
        ▼
   ┌──────────┐
   │ 运行状态  │
   │ 主Agent  │
   │ 开始协调  │
   └──────────┘
```

---

## 附录

### A. 支持的 CLI 列表

- Claude Code
- Gemini CLI
- Codex
- Amp
- Cursor Agent
- Qwen Code
- Copilot
- Droid
- Opencode

### B. 系统内置斜杠命令

| 命令 | 说明 |
|------|------|
| /write-code | 编写功能代码 |
| /review | 代码审计，检查安全性和代码质量 |
| /fix-issues | 修复发现的问题 |
| /test | 运行测试 |
| /refactor | 重构代码 |
| /document | 编写文档 |

---

*文档版本: 1.0*
*创建日期: 2026-01-16*
