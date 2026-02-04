# Phase 23: 终端进程隔离修复（cc-switch 架构重构）

> **状态:** 📋 待实施
> **优先级:** 🔴 高（核心架构缺陷修复）
> **目标:** 实现终端进程级别的配置隔离，避免修改全局配置文件
> **前置条件:** Phase 22 WebSocket 事件广播完成 ✅
> **发现时间:** 2026-02-04
> **发现方式:** 端到端测试时发现终端黑屏问题，追踪到 cc-switch 架构缺陷

---

## 问题描述

### 当前错误架构

当前 cc-switch 模块在切换模型时会修改全局配置文件，导致严重问题：

```
┌─────────────────────────────────────────────────────────────┐
│                    当前错误流程                              │
├─────────────────────────────────────────────────────────────┤
│  1. launcher.rs 调用 cc_switch.switch_for_terminal()        │
│  2. cc_switch 修改全局 ~/.claude/settings.json              │
│  3. 启动终端进程                                             │
│  4. 终端进程读取全局配置                                     │
└─────────────────────────────────────────────────────────────┘
```

### 问题影响

1. **多工作流冲突**: 多个工作流同时运行时会互相覆盖配置
2. **用户配置被破坏**: 用户的全局 Claude Code 配置会被覆盖
3. **无进程隔离**: 所有终端共享同一份配置，无法实现真正的隔离
4. **竞态条件**: 配置写入和进程启动之间存在时间窗口

### 正确架构

```
┌─────────────────────────────────────────────────────────────┐
│                    正确隔离流程                              │
├─────────────────────────────────────────────────────────────┤
│  1. launcher.rs 调用 cc_switch.get_env_vars_for_terminal()  │
│  2. cc_switch 返回环境变量 HashMap（不写文件）               │
│  3. spawn_pty 通过 cmd.env() 注入环境变量                   │
│  4. 终端进程使用注入的环境变量（进程级隔离）                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 技术分析

> **Codex 主脑审查意见 (2026-02-04):**
> - 方案方向正确，但需要补充环境污染治理和 CLI 参数传递
> - Codex CLI 支持 `--config` 内联 TOML 覆盖，优先级高于配置文件
> - 建议使用 `CODEX_HOME` 实现完全隔离
> - 需要检查 `TerminalCoordinator` 是否仍调用 `switch_for_terminal`

### 涉及的环境变量

#### Claude Code
```bash
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
ANTHROPIC_AUTH_TOKEN=sk-xxx
ANTHROPIC_MODEL=glm-4.7
ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-4.7
ANTHROPIC_DEFAULT_SONNET_MODEL=glm-4.7
ANTHROPIC_DEFAULT_OPUS_MODEL=glm-4.7
```

#### Codex (Codex 主脑补充)
```bash
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.example.com/v1  # 自定义 API endpoint
CODEX_HOME=/tmp/gitcortex/terminal-xxx      # 隔离本地状态目录
```

**CLI 参数（优先级高于配置文件）：**
```bash
codex --model gpt-5.2-codex-xhigh --config 'forced_login_method="api"'
```

#### Gemini CLI
```bash
GOOGLE_GEMINI_BASE_URL=https://api.example.com
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.5-pro
```

### 需要修改的文件

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `crates/services/src/services/terminal/process.rs` | 重构 | 新增 SpawnCommand/SpawnEnv，支持 env + args + env_remove |
| `crates/services/src/services/terminal/launcher.rs` | 修改 | 使用 build_launch_config 替代 switch_for_terminal |
| `crates/services/src/services/cc_switch.rs` | 重构 | 添加 build_launch_config 方法，返回 env + args |
| `crates/services/src/services/orchestrator/terminal_coordinator.rs` | 检查 | 确认是否仍调用 switch_for_terminal |
| `crates/cc-switch/src/lib.rs` | 可选 | 添加 get_env_vars 方法（不写文件） |

---

## 实施计划

> **任务总数:** 28 个（基于 Codex 主脑审查后更新）

### P0 - 核心接口重构（SpawnCommand/SpawnEnv）

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 23.1 | 新增 `SpawnCommand` 结构体，包含 command/args/working_dir | ⬜ |  |
| 23.2 | 新增 `SpawnEnv` 结构体，包含 set/unset 字段，支持环境变量注入和清理 | ⬜ |  |
| 23.3 | 修改 spawn_pty 签名，接收 `SpawnCommand` + `SpawnEnv` 参数 | ⬜ |  |
| 23.4 | 实现 `env_remove` 清理继承的环境变量（避免父进程污染） | ⬜ |  |
| 23.5 | 更新所有 spawn_pty 调用点 | ⬜ |  |

### P1 - cc_switch 服务重构

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 23.6 | 新增 `build_launch_config(&Terminal) -> (SpawnEnv, Vec<String>)` 方法 | ⬜ |  |
| 23.7 | 实现 Claude Code 环境变量构建（ANTHROPIC_*） | ⬜ |  |
| 23.8 | 实现 Codex 环境变量构建（OPENAI_API_KEY, OPENAI_BASE_URL, CODEX_HOME） | ⬜ |  |
| 23.9 | 实现 Codex CLI 参数构建（--model, --config forced_login_method="api"） | ⬜ |  |
| 23.10 | 实现 Gemini CLI 环境变量构建（GEMINI_*） | ⬜ |  |
| 23.11 | 对不支持配置切换的 CLI 返回空配置（而非失败） | ⬜ |  |
| 23.12 | 标记 switch_for_terminal 为 deprecated | ⬜ |  |

### P2 - launcher 集成

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 23.13 | 修改 launch_terminal 使用 build_launch_config | ⬜ |  |
| 23.14 | 将 SpawnEnv + args 传递给 spawn_pty | ⬜ |  |
| 23.15 | 移除 switch_for_terminal 调用 | ⬜ |  |
| 23.16 | 移除 launch_all 中的 500ms 延时（env 注入不需要等待） | ⬜ |  |
| 23.17 | 添加环境变量注入的日志记录（脱敏） | ⬜ |  |

### P3 - Codex 完全隔离

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 23.18 | 为每个 Codex 终端生成独立的 CODEX_HOME 临时目录 | ⬜ |  |
| 23.19 | 终端结束后清理 CODEX_HOME 临时目录 | ⬜ |  |
| 23.20 | 测试 Codex 终端完全隔离启动 | ⬜ |  |

### P4 - 环境污染治理

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 23.21 | 当 custom_base_url 为空时，对 *_BASE_URL 进行 env_remove | ⬜ |  |
| 23.22 | 检查 TerminalCoordinator 是否仍调用 switch_for_terminal，如有则移除 | ⬜ |  |

### P5 - 测试与验证

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 23.23 | 新增 spawn_pty env/unset 测试 | ⬜ |  |
| 23.24 | 新增 build_launch_config 单测 | ⬜ |  |
| 23.25 | 新增 Codex args 注入测试 | ⬜ |  |
| 23.26 | 新增多终端并发启动隔离测试 | ⬜ |  |
| 23.27 | 验证用户全局配置不被修改 | ⬜ |  |
| 23.28 | 端到端测试：工作流创建 -> 终端启动 -> 命令执行 | ⬜ |  |

---

## 代码修改详情

### 23.1-23.5: SpawnCommand/SpawnEnv 设计（Codex 主脑建议）

**文件:** `crates/services/src/services/terminal/process.rs`

```rust
use std::collections::HashMap;

/// 环境变量配置（支持注入和清理）
#[derive(Debug, Clone, Default)]
pub struct SpawnEnv {
    /// 要设置的环境变量
    pub set: HashMap<String, String>,
    /// 要从父进程移除的环境变量（避免继承污染）
    pub unset: Vec<String>,
}

/// 进程启动命令配置
#[derive(Debug, Clone)]
pub struct SpawnCommand {
    /// 命令（如 "claude", "codex"）
    pub command: String,
    /// 命令参数（如 ["--model", "gpt-5.2-codex-xhigh"]）
    pub args: Vec<String>,
    /// 工作目录
    pub working_dir: std::path::PathBuf,
    /// 环境变量配置
    pub env: SpawnEnv,
}

impl ProcessManager {
    /// 使用 SpawnCommand 启动 PTY 进程
    pub async fn spawn_pty_with_config(
        &self,
        terminal_id: &str,
        config: &SpawnCommand,
        cols: u16,
        rows: u16,
    ) -> anyhow::Result<ProcessHandle> {
        let pty_system = native_pty_system();
        let size = PtySize { rows, cols, pixel_width: 0, pixel_height: 0 };
        let pair = pty_system.openpty(size)?;

        // 构建命令
        #[cfg(windows)]
        let mut cmd = {
            let mut c = CommandBuilder::new("cmd.exe");
            c.arg("/c");
            c.arg(&config.command);
            for arg in &config.args {
                c.arg(arg);
            }
            c
        };
        #[cfg(not(windows))]
        let mut cmd = {
            let mut c = CommandBuilder::new(&config.command);
            for arg in &config.args {
                c.arg(arg);
            }
            c
        };

        cmd.cwd(&config.working_dir);

        // 基础环境变量
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // 清理继承的环境变量（避免父进程污染）
        for key in &config.env.unset {
            cmd.env_remove(key);
            tracing::debug!(terminal_id = %terminal_id, key = %key, "Removed inherited env var");
        }

        // 注入自定义环境变量
        for (key, value) in &config.env.set {
            cmd.env(key, value);
            // 脱敏日志：不记录 API Key 的值
            if key.contains("KEY") || key.contains("TOKEN") || key.contains("SECRET") {
                tracing::debug!(terminal_id = %terminal_id, key = %key, "Injected env var [REDACTED]");
            } else {
                tracing::debug!(terminal_id = %terminal_id, key = %key, value = %value, "Injected env var");
            }
        }

        // ... 后续启动逻辑保持不变
    }
}
```

### 23.6-23.12: build_launch_config 实现

**文件:** `crates/services/src/services/cc_switch.rs`

```rust
impl CCSwitchService {
    /// 构建终端启动配置（环境变量 + CLI 参数）
    ///
    /// 不写入任何全局配置文件，实现进程级隔离
    pub async fn build_launch_config(
        &self,
        terminal: &Terminal,
        base_command: &str,
        working_dir: &std::path::Path,
    ) -> anyhow::Result<SpawnCommand> {
        let cli_type = CliType::find_by_id(&self.db.pool, &terminal.cli_type_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("CLI type not found"))?;

        let model_config = ModelConfig::find_by_id(&self.db.pool, &terminal.model_config_id)
            .await?
            .ok_or_else(|| anyhow::anyhow!("Model config not found"))?;

        let cli = CcCliType::parse(&cli_type.name);

        let mut env = SpawnEnv::default();
        let mut args = Vec::new();

        match cli {
            Some(CcCliType::ClaudeCode) => {
                // Claude Code 环境变量
                if let Some(base_url) = &terminal.custom_base_url {
                    env.set.insert("ANTHROPIC_BASE_URL".to_string(), base_url.clone());
                } else {
                    // 清理可能继承的 BASE_URL
                    env.unset.push("ANTHROPIC_BASE_URL".to_string());
                }

                let api_key = self.resolve_api_key(terminal, &CcCliType::ClaudeCode).await?;
                env.set.insert("ANTHROPIC_AUTH_TOKEN".to_string(), api_key);

                let model = model_config.api_model_id
                    .clone()
                    .unwrap_or_else(|| model_config.name.clone());
                env.set.insert("ANTHROPIC_MODEL".to_string(), model.clone());
                env.set.insert("ANTHROPIC_DEFAULT_HAIKU_MODEL".to_string(), model.clone());
                env.set.insert("ANTHROPIC_DEFAULT_SONNET_MODEL".to_string(), model.clone());
                env.set.insert("ANTHROPIC_DEFAULT_OPUS_MODEL".to_string(), model);
            }
            Some(CcCliType::Codex) => {
                // Codex 环境变量
                let api_key = terminal.get_custom_api_key()?
                    .ok_or_else(|| anyhow::anyhow!("Codex requires API key"))?;
                env.set.insert("OPENAI_API_KEY".to_string(), api_key);

                if let Some(base_url) = &terminal.custom_base_url {
                    env.set.insert("OPENAI_BASE_URL".to_string(), base_url.clone());
                } else {
                    env.unset.push("OPENAI_BASE_URL".to_string());
                }

                // 设置独立的 CODEX_HOME 目录
                let codex_home = std::env::temp_dir()
                    .join("gitcortex")
                    .join(format!("codex-{}", terminal.id));
                std::fs::create_dir_all(&codex_home)?;
                env.set.insert("CODEX_HOME".to_string(), codex_home.to_string_lossy().to_string());

                // CLI 参数（优先级高于配置文件）
                let model = model_config.api_model_id
                    .clone()
                    .unwrap_or_else(|| model_config.name.clone());
                args.push("--model".to_string());
                args.push(model);
                args.push("--config".to_string());
                args.push("forced_login_method=\"api\"".to_string());
            }
            Some(CcCliType::Gemini) => {
                // Gemini CLI 环境变量
                if let Some(base_url) = &terminal.custom_base_url {
                    env.set.insert("GOOGLE_GEMINI_BASE_URL".to_string(), base_url.clone());
                } else {
                    env.unset.push("GOOGLE_GEMINI_BASE_URL".to_string());
                }

                let api_key = terminal.get_custom_api_key()?
                    .ok_or_else(|| anyhow::anyhow!("Gemini requires API key"))?;
                env.set.insert("GEMINI_API_KEY".to_string(), api_key);

                let model = model_config.api_model_id
                    .clone()
                    .unwrap_or_else(|| model_config.name.clone());
                env.set.insert("GEMINI_MODEL".to_string(), model);
            }
            _ => {
                // 不支持配置切换的 CLI，返回空配置（不失败）
                tracing::warn!(
                    "CLI {} does not support config switching, using empty config",
                    cli_type.name
                );
            }
        }

        Ok(SpawnCommand {
            command: base_command.to_string(),
            args,
            working_dir: working_dir.to_path_buf(),
            env,
        })
    }

    /// [DEPRECATED] 使用 build_launch_config 替代
    #[deprecated(since = "0.2.0", note = "Use build_launch_config instead to avoid modifying global config")]
    pub async fn switch_for_terminal(&self, terminal: &Terminal) -> anyhow::Result<()> {
        // 保留旧实现以向后兼容
        // ...
    }
}
```

### 23.13-23.17: launcher 集成

**文件:** `crates/services/src/services/terminal/launcher.rs`

```rust
pub async fn launch_terminal(&self, terminal: &Terminal) -> LaunchResult {
    let terminal_id = terminal.id.clone();

    // 1. 获取 CLI 命令
    let cli_type = match cli_type::CliType::find_by_id(&self.db.pool, &terminal.cli_type_id).await {
        Ok(Some(cli)) => cli,
        Ok(None) => return LaunchResult::error(&terminal_id, "CLI type not found"),
        Err(e) => return LaunchResult::error(&terminal_id, &format!("Database error: {e}")),
    };
    let cli_command = self.get_cli_command(&cli_type.name);

    // 2. 构建启动配置（不修改全局配置文件）
    let spawn_config = match self.cc_switch.build_launch_config(
        terminal,
        &cli_command,
        &self.working_dir,
    ).await {
        Ok(config) => config,
        Err(e) => {
            tracing::error!("Failed to build launch config for terminal {}: {}", terminal_id, e);
            return LaunchResult::error(&terminal_id, &format!("Config build failed: {e}"));
        }
    };

    // 3. 启动进程（使用环境变量注入，无需等待）
    match self.process_manager.spawn_pty_with_config(
        &terminal_id,
        &spawn_config,
        DEFAULT_COLS,
        DEFAULT_ROWS,
    ).await {
        Ok(handle) => {
            // 更新数据库状态...
            LaunchResult::success(&terminal_id, handle)
        }
        Err(e) => LaunchResult::error(&terminal_id, &format!("Process spawn failed: {e}")),
    }
}

pub async fn launch_all(&self, workflow_id: &str) -> anyhow::Result<Vec<LaunchResult>> {
    let terminals = Terminal::find_by_workflow(&self.db.pool, workflow_id).await?;
    let mut results = Vec::new();

    for terminal in terminals {
        let result = self.launch_terminal(&terminal).await;
        results.push(result);
        // 移除 500ms 延时 - env 注入不需要等待
    }

    Ok(results)
}
```

---

## 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Codex 不支持纯环境变量配置 | 高 | 中 | 实现临时配置文件方案 |
| 环境变量泄露到日志 | 中 | 低 | 日志脱敏处理 |
| 现有测试失败 | 中 | 中 | 更新测试用例 |
| 向后兼容性问题 | 低 | 低 | 保留旧方法但标记 deprecated |

---

## 验收标准

### 功能验收
- [ ] 终端启动时不修改 ~/.claude/settings.json
- [ ] 终端启动时不修改 ~/.codex/config.toml
- [ ] 多个工作流可同时运行，配置互不干扰
- [ ] 用户全局配置保持不变

### 测试验收
- [ ] spawn_pty 环境变量注入测试通过
- [ ] get_env_vars_for_terminal 单测通过
- [ ] 多终端并发隔离测试通过
- [ ] 端到端测试通过

### 代码质量
- [ ] 无新增编译警告
- [ ] 日志中 API Key 已脱敏
- [ ] 文档已更新

---

## 参考资料

### cc-switch 原项目
- GitHub: https://github.com/farion1231/cc-switch
- 配置结构参考: `src-tauri/src/provider.rs`

### Claude Code 环境变量
- ANTHROPIC_BASE_URL: API 基础地址
- ANTHROPIC_AUTH_TOKEN: 认证令牌
- ANTHROPIC_MODEL: 默认模型

### Codex 配置
- OPENAI_API_KEY: API 密钥
- config.toml: 模型提供商配置

---

## 附录：当前代码位置

- cc_switch 服务: `crates/services/src/services/cc_switch.rs`
- 终端启动器: `crates/services/src/services/terminal/launcher.rs`
- 进程管理: `crates/services/src/services/terminal/process.rs`
- cc-switch crate: `crates/cc-switch/src/`
