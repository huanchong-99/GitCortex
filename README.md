<p align="center">
  <img src="docs/assets/gitcortex-logo.svg" alt="GitCortex Logo" width="200">
</p>

<p align="center">
  <strong>AI Agent 跨终端任务协调平台</strong>
</p>

<p align="center">
  基于 <a href="https://github.com/BloopAI/vibe-kanban">Vibe Kanban</a> 改造，集成 <a href="https://github.com/farion1231/cc-switch">CC-Switch</a> 模型切换能力
</p>

---

## 概述

GitCortex 是一个 AI 驱动的多终端任务协调平台，让多个 AI 编码代理（Claude Code、Gemini CLI、Codex 等）能够并行协作完成复杂的软件开发任务。

### 核心特性

| 特性 | 说明 |
|------|------|
| **主 Agent 协调** | AI 驱动的中央控制器，负责任务分发、进度监控、结果审核 |
| **多任务并行** | 多个 Task 同时执行，每个 Task 有独立 Git 分支 |
| **任务内串行** | 每个 Task 内的 Terminal 按顺序执行（编码→审核→修复） |
| **cc-switch 集成** | 一键切换任意 CLI 的模型配置 |
| **事件驱动** | 基于 Git 提交的事件驱动模式，节省 98%+ Token 消耗 |
| **终端调试视图** | 启动后可进入原生终端验证环境配置 |
| **工作流持久化** | 完整的 Workflow/Task/Terminal 三层数据模型 |
| **斜杠命令系统** | 可复用的提示词预设，支持模板变量替换 |
| **多模型支持** | 支持 Claude、Gemini、OpenAI 等多种 AI 模型 |
| **Git 集成** | 深度集成 Git，自动管理分支和合并 |

### 架构概览

```
╔═══════════════════════════════════════════════════════════════════╗
║                     Orchestrator (主 Agent)                        ║
║           用户配置: API类型 + Base URL + API Key + 模型            ║
╚═══════════════════════════════════════════════════════════════════╝
         │                      │                      │
         ▼                      ▼                      ▼
  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
  │   Task 1    │       │   Task 2    │       │   Task 3    │
  │ branch:login│       │ branch:i18n │       │ branch:theme│
  │  T1→T2→T3   │       │   TA→TB     │       │   TX→TY     │
  └─────────────┘       └─────────────┘       └─────────────┘
         ║                      ║                      ║
         ╚══════════════════════╩══════════════════════╝
                         任务间并行执行
                              │
                              ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                   全局合并终端 (Merge Terminal)                  │
  └─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                          [ main ]
```

---

## 快速开始

### 前置要求

| 工具 | 版本要求 | 说明 |
|------|----------|------|
| **Rust** | 1.75+ 或 nightly-2025-12-04 | 定义在 `rust-toolchain.toml` |
| **Node.js** | >= 20 | 前端运行时 |
| **pnpm** | 10.13.1 | 包管理器 |
| **CMake** | 最新版 | 构建工具（某些系统需要） |
| **SQLite** | 3.x | 数据库（通常内置） |

### 安装

#### 1. 安装 Rust 工具链

```bash
# 安装 Rustup
# 下载：https://rustup.rs/ 或使用 winget
winget install Rustlang.Rustup

# 安装项目指定版本
rustup install nightly-2025-12-04
rustup default nightly-2025-12-04

# 安装 Cargo 工具
cargo install cargo-watch
cargo install sqlx-cli --features sqlite

# 验证安装
rustc --version
# 应输出：rustc 1.85.0-nightly (2025-12-04)
```

#### 2. 安装 Node.js 和 pnpm

```bash
# 推荐使用 nvm-windows
# 下载：https://github.com/coreybutler/nvm-windows
nvm install 20
nvm use 20

# 安装指定版本 pnpm
npm install -g pnpm@10.13.1

# 验证安装
pnpm --version
# 应输出：10.13.1
```

#### 3. 克隆并启动项目

```bash
# 克隆仓库
git clone <your-repo-url>
cd GitCortex

# 安装依赖
pnpm install

# 设置环境变量（必需）
# Windows PowerShell
$env:GITCORTEX_ENCRYPTION_KEY="12345678901234567890123456789012"

# Linux/macOS
export GITCORTEX_ENCRYPTION_KEY="12345678901234567890123456789012"

# 运行数据库迁移
pnpm run db:migrate

# 构建后端（Rust）
cargo build --release

# 启动开发服务器
pnpm run dev
```

访问：
- 前端：http://localhost:3000
- 后端 API：http://localhost:3001/api

**详细运维指南：** 查看 [Operations Manual](docs/ops/runbook.md) 了解生产部署、监控、升级等详细操作。

### 从现有仓库恢复

如果你已经克隆过仓库，只需确保工具版本正确并重新安装依赖：

```bash
cd GitCortex

# 检查 Rust 版本
rustc --version
# 如版本不对，运行：
rustup default nightly-2025-12-04

# 重新安装依赖
pnpm install

# 设置环境变量并启动
$env:GITCORTEX_ENCRYPTION_KEY="12345678901234567890123456789012"
pnpm run dev
```

---

## 开发环境配置

### IDE 推荐

- **VS Code** + 插件：
  - `rust-analyzer`（Rust 语言服务器）
  - `ESLint`（前端检查）
  - `Prettier`（代码格式化）

### 环境变量

创建 `.env` 文件或设置系统环境变量：

```bash
# 必需：加密密钥（32字节十六进制）
GITCORTEX_ENCRYPTION_KEY=your-32-byte-hex-key-here

# 可选
PORT=3001                    # 后端端口
VITE_PORT=3000               # 前端端口
DATABASE_URL=crates/db/data.db  # 数据库路径
```

### 数据库

项目使用 SQLite（嵌入式），无需安装数据库服务器：
- 位置：`crates/db/data.db`
- 迁移文件：`crates/db/migrations/`

### 验证安装

```bash
# 后端编译检查
cargo check --workspace

# 前端编译检查
pnpm run check

# 运行测试
cargo test --workspace
pnpm test -- --run
```

---

## 项目结构

```
GitCortex/
├── crates/                    # Rust workspace
│   ├── db/                    # 数据库层（模型 + DAO + 迁移）
│   ├── server/                # Axum 后端服务器
│   ├── services/              # 业务逻辑层
│   │   ├── orchestrator/      # 主 Agent 编排逻辑
│   │   ├── terminal/          # 终端进程管理
│   │   ├── git_watcher/       # Git 事件监听
│   │   └── cc_switch/         # 模型切换服务
│   └── utils/                 # 工具函数
├── frontend/                  # React + TypeScript 前端
│   ├── src/
│   │   ├── components/        # UI 组件
│   │   │   ├── workflow/      # 工作流向导组件
│   │   │   └── terminal/      # 终端调试组件
│   │   ├── hooks/             # React Hooks
│   │   ├── pages/             # 页面组件
│   │   └── i18n/              # 国际化配置
│   └── package.json
├── shared/                    # 前后端共享类型（自动生成）
├── docs/                      # 文档
│   ├── plans/                 # 实施计划
│   └── assets/                # 资源文件
├── Cargo.toml                 # Workspace 配置
├── rust-toolchain.toml        # Rust 版本锁定
├── package.json               # Root package.json
└── pnpm-workspace.yaml        # pnpm workspace 配置
```

---

## 开发进度

> **当前状态：** Phase 11 已完成（单项目结构迁移 + 代码审计 68/100 分）
> **下一步：** Phase 12 - Workflow API 契约与类型生成对齐

| Phase | 内容 | 状态 | 完成时间 |
|-------|------|------|----------|
| Phase 0 | 项目文档重写 | ✅ | 2026-01-16 |
| Phase 1 | 数据库模型扩展 | ✅ | 2026-01-17 |
| Phase 2 | CC-Switch 核心提取与集成 | ✅ | 2026-01-17 |
| Phase 3 | Orchestrator 主 Agent 实现 | ✅ | 2026-01-18 |
| Phase 4 | 终端管理与启动机制 | ✅ | 2026-01-18 |
| Phase 5 | Git 事件驱动系统 | ✅ | 2026-01-18 |
| Phase 6 | 前端界面改造（7步向导） | ✅ | 2026-01-18 |
| Phase 7 | 终端调试视图 | ✅ | 2026-01-19 |
| Phase 8.5 | 代码质量修复 | ✅ | 2026-01-19 |
| Phase 8 | 集成测试与文档 | ✅ | 2026-01-19 |
| Phase 9 | S级代码质量冲刺（100分） | ✅ | 2026-01-20 |
| Phase 10 | 告警清零交付 | ✅ | 2026-01-20 |
| **Phase 11** | **单项目结构迁移 + 审计** | ✅ | **2026-01-21** |
| Phase 12 | Workflow API 契约与类型对齐 | ⬜ | - |
| Phase 13 | Workflow 创建与持久化 | ⬜ | - |
| Phase 14 | Orchestrator 运行时接入 | ⬜ | - |
| Phase 15 | 终端执行与 WebSocket 链路 | ⬜ | - |
| Phase 16 | 前端工作流体验完备 | ⬜ | - |
| Phase 17 | 斜杠命令系统与提示词 | ⬜ | - |
| Phase 18 | 全链路测试与发布就绪 | ⬜ | - |

**总体进度：** 11/18 Phase 完成（61.1%）

详细进度追踪：[docs/plans/TODO.md](docs/plans/TODO.md)

**已知问题（影响审计评分）：**
- Terminal 日志缓冲满时未持久化，存在日志丢失风险 (Task 4.1)
- Terminal 启动时 CLI 名称硬编码 ✅ (已修复 - Task 4.2)
- asset_dir 错误处理使用 panic ✅ (已修复 - Task 4.3)
- Terminal 状态语义不一致 ✅ (已修复 - Task 4.4)

---

## 架构设计

### 数据模型

GitCortex 采用三层模型：

1. **Workflow（工作流）** - 顶层容器
   - 包含多个 Task
   - 配置 Orchestrator（主 Agent）
   - 配置 Merge Terminal（合并终端）
   - 可选 Error Terminal（错误处理）

2. **WorkflowTask（任务）** - 中层单元
   - 每个 Task 对应一个 Git 分支
   - 包含多个 Terminal
   - 独立状态：pending → running → completed

3. **Terminal（终端）** - 底层执行单元
   - 绑定特定 CLI 类型（Claude/Gemini/Codex）
   - 绑定特定模型配置
   - 串行执行：waiting → working → completed

### 状态机

**Workflow 状态流转：**
```
created → starting → ready → running → (paused) → merging → completed/failed
                                              ↓
                                          cancelled
```

**Terminal 状态流转：**
```
not_started → starting → waiting → working → completed
                                         ↓
                                      failed/cancelled
```

### 核心服务

| 服务 | 职责 |
|------|------|
| **OrchestratorAgent** | 主 Agent，负责任务分发、进度监控、结果审核 |
| **MessageBus** | 跨终端消息路由 |
| **TerminalLauncher** | 终端进程启动与管理 |
| **GitWatcher** | 监听 Git 事件（.git/refs/heads 变化） |
| **CCSwitchService** | 模型配置切换（原子写入配置文件） |
| **WorkflowService** | 工作流 CRUD 与状态管理 |

---

## 支持的 CLI

| CLI | 名称 | 检测命令 | 配置文件路径 |
|-----|------|----------|--------------|
| Claude Code | Claude Code | `claude --version` | `~/.claude/settings.json` |
| Gemini CLI | Gemini | `gemini --version` | `~/.gemini/.env` |
| Codex | Codex | `codex --version` | `~/.codex/auth.json`, `~/.codex/config.toml` |
| Amp | Amp | `amp --version` | - |
| Cursor Agent | Cursor | `cursor --version` | - |
| Qwen Code | Qwen | `qwen --version` | - |
| GitHub Copilot | Copilot | `gh copilot --version` | - |
| Droid | Droid | `droid --version` | - |
| Opencode | Opencode | `opencode --version` | - |

### 模型切换

CC-Switch 提供原子写入机制，安全切换 CLI 模型配置：

- ✅ 支持同时配置多个 CLI
- ✅ 临时切换（单次工作流）
- ✅ 永久切换（修改配置文件）
- ✅ 自动备份原配置
- ✅ 验证模型可用性

---

## 使用指南

### 创建工作流

1. 点击"新建工作流"
2. 选择项目
3. 配置基础信息
4. 添加任务与终端
5. 选择模型与 CLI
6. 启动工作流

### 运维操作

对于生产环境部署、数据库管理、监控和故障排查，请参阅：

- **运维手册：** [docs/ops/runbook.md](docs/ops/runbook.md)
  - 启动服务器（开发/生产模式）
  - 数据库管理（备份/恢复/迁移）
  - 监控与性能调优
  - 升级和回滚流程

- **故障排查：** [docs/ops/troubleshooting.md](docs/ops/troubleshooting.md)
  - 服务器无法启动
  - 工作流卡住
  - API 密钥问题
  - 终端无输出
  - 数据库锁定

### 测试与构建

```bash
# 运行测试
cargo test --workspace
pnpm test -- --run

# 构建生产版本
pnpm run build

# 类型生成
pnpm run generate-types
pnpm run generate-types:check
```

---

## 文档

### 实施计划

- [总体概览](docs/plans/00-overview.md)
- [Phase 0-11](docs/plans)（已完成阶段）
- [Phase 12-18](docs/plans)（待实施阶段）

### 核心设计文档

- [Orchestrator 架构设计](docs/plans/2026-01-16-orchestrator-design.md)
- [GitCortex 详细实现计划](docs/plans/2026-01-16-gitcortex-implementation.md)

### 进度追踪

- [开发进度追踪表](docs/plans/TODO.md)

---

## 常见问题

### Q: 编译失败，提示找不到 nightly 版本？

确保安装了正确的 Rust 版本：

```bash
rustup install nightly-2025-12-04
rustup default nightly-2025-12-04
```

### Q: 创建 Workflow 失败，提示加密密钥错误？

确保设置了环境变量：

```bash
# Windows PowerShell
$env:GITCORTEX_ENCRYPTION_KEY="12345678901234567890123456789012"

# Linux/macOS
export GITCORTEX_ENCRYPTION_KEY="12345678901234567890123456789012"
```

### Q: CLI 检测失败，显示未安装？

确保 CLI 已安装并可在 PATH 中找到：

```bash
claude --version
gemini --version
codex --version
```

### Q: 测试时出现 Browserslist 警告？

更新 Browserslist 数据库：

```bash
pnpm dlx browserslist@latest --update-db
```

---

## 贡献

欢迎提交 Issue 和 Pull Request！

### 开发规范

- **Rust 代码**：遵循 `cargo fmt` 和 `cargo clippy` 规范
- **前端代码**：使用 ESLint + Prettier，严格模式
- **提交信息**：使用约定式提交（Conventional Commits）

### 代码质量标准

项目当前代码审计分数：**68/100 (B级，目标 90+)**

- 架构与设计一致性：需提升
- 代码健壮性与逻辑：需提升
- 代码风格与可维护性：部分达标
- 性能与安全性：需提升
- 文档与注释：需补充

---

## 致谢

本项目基于以下优秀的开源项目：

- **[Vibe Kanban](https://github.com/BloopAI/vibe-kanban)** - AI 编码代理任务管理平台 (Apache 2.0)
- **[CC-Switch](https://github.com/farion1231/cc-switch)** - Claude Code/Codex/Gemini CLI 配置切换工具 (MIT)

感谢这些项目的作者和贡献者！

---

## 许可证

本项目遵循上游项目的开源协议：

- Vibe Kanban 部分：Apache License 2.0
- CC-Switch 部分：MIT License

详见 [LICENSE](LICENSE) 文件。

---

<p align="center">
  <em>GitCortex - 让 AI 代理协同工作</em>
</p>
