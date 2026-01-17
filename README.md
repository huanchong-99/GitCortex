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

## 安装

### 前置要求

- [Rust](https://rustup.rs/) (latest stable)
- [Node.js](https://nodejs.org/) (>=18)
- [pnpm](https://pnpm.io/) (>=8)

### 开发工具

```bash
cargo install cargo-watch
cargo install sqlx-cli
```

### 安装依赖

```bash
pnpm i
```

### 运行开发服务器

```bash
pnpm run dev
```

## 支持的 CLI

- Claude Code
- Gemini CLI
- Codex
- Amp
- Cursor Agent
- Qwen Code
- Copilot
- Droid
- Opencode

## 文档

- [设计文档](docs/plans/2026-01-16-orchestrator-design.md)
- [实现计划](docs/plans/2026-01-16-gitcortex-implementation.md)

## 致谢

本项目基于以下优秀的开源项目：

- **[Vibe Kanban](https://github.com/BloopAI/vibe-kanban)** - AI 编码代理任务管理平台 (Apache 2.0)
- **[CC-Switch](https://github.com/farion1231/cc-switch)** - Claude Code/Codex/Gemini CLI 配置切换工具 (MIT)

感谢这些项目的作者和贡献者！

## 许可证

本项目遵循上游项目的开源协议：

- Vibe Kanban 部分：Apache License 2.0
- CC-Switch 部分：MIT License

详见 [LICENSE](LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request！

---

*GitCortex - 让 AI 代理协同工作*
