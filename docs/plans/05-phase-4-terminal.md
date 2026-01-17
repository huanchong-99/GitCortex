# Phase 4: 终端管理与启动机制

> **状态:** ⬜ 未开始
> **进度追踪:** 查看 `TODO.md`
> **前置条件:** Phase 3 完成

## 概述

实现终端进程管理，包括启动器、进程生命周期管理和 CLI 检测。

---

## Phase 4: 终端管理与启动机制

### Task 4.1: 实现 TerminalLauncher

**状态:** ⬜ 未开始

**前置条件:**
- Phase 3 已完成
- cc-switch 服务可用

**目标:**
实现终端启动器，负责串行启动所有终端（切换环境变量 → 启动 → 下一个）。

**涉及文件:**
- 创建: `vibe-kanban-main/crates/services/src/services/terminal/mod.rs`
- 创建: `vibe-kanban-main/crates/services/src/services/terminal/launcher.rs`
- 修改: `vibe-kanban-main/crates/services/src/services/mod.rs`

---

**Step 4.1.1: 创建 terminal/mod.rs**

文件路径: `vibe-kanban-main/crates/services/src/services/terminal/mod.rs`

```rust
//! 终端管理模块

pub mod launcher;
pub mod process;
pub mod detector;

pub use launcher::TerminalLauncher;
pub use process::{ProcessHandle, ProcessManager};
pub use detector::CliDetector;
```

---

**Step 4.1.2: 创建 launcher.rs**

文件路径: `vibe-kanban-main/crates/services/src/services/terminal/launcher.rs`

```rust
//! 终端启动器

use std::sync::Arc;
use std::path::PathBuf;
use tokio::process::Command;
use db::DBService;
use db::models::{Terminal, terminal_dao, cli_type_dao, workflow_dao};
use super::process::{ProcessHandle, ProcessManager};
use crate::services::cc_switch::CCSwitchService;

/// 终端启动器
pub struct TerminalLauncher {
    db: Arc<DBService>,
    cc_switch: Arc<CCSwitchService>,
    process_manager: Arc<ProcessManager>,
    working_dir: PathBuf,
}

/// 启动结果
pub struct LaunchResult {
    pub terminal_id: String,
    pub process_handle: Option<ProcessHandle>,
    pub success: bool,
    pub error: Option<String>,
}

impl TerminalLauncher {
    pub fn new(
        db: Arc<DBService>,
        cc_switch: Arc<CCSwitchService>,
        process_manager: Arc<ProcessManager>,
        working_dir: PathBuf,
    ) -> Self {
        Self { db, cc_switch, process_manager, working_dir }
    }

    /// 启动工作流的所有终端（串行）
    pub async fn launch_all(&self, workflow_id: &str) -> anyhow::Result<Vec<LaunchResult>> {
        let terminals = terminal_dao::get_terminals_by_workflow(&self.db.pool, workflow_id).await?;
        let mut results = Vec::new();

        tracing::info!("Launching {} terminals for workflow {}", terminals.len(), workflow_id);

        for terminal in terminals {
            let result = self.launch_terminal(&terminal).await;
            results.push(result);

            // 短暂延迟，确保环境变量切换生效
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        }

        Ok(results)
    }

    /// 启动单个终端
    async fn launch_terminal(&self, terminal: &Terminal) -> LaunchResult {
        let terminal_id = terminal.id.clone();

        // 1. 切换模型配置
        if let Err(e) = self.cc_switch.switch_for_terminal(terminal).await {
            tracing::error!("Failed to switch model for terminal {}: {}", terminal_id, e);
            return LaunchResult {
                terminal_id,
                process_handle: None,
                success: false,
                error: Some(format!("Model switch failed: {}", e)),
            };
        }

        // 2. 获取 CLI 信息
        let cli_type = match cli_type_dao::get_cli_type_by_id(&self.db.pool, &terminal.cli_type_id).await {
            Ok(Some(cli)) => cli,
            Ok(None) => {
                return LaunchResult {
                    terminal_id,
                    process_handle: None,
                    success: false,
                    error: Some("CLI type not found".to_string()),
                };
            }
            Err(e) => {
                return LaunchResult {
                    terminal_id,
                    process_handle: None,
                    success: false,
                    error: Some(format!("Database error: {}", e)),
                };
            }
        };

        // 3. 构建启动命令
        let cmd = self.build_launch_command(&cli_type.name);

        // 4. 启动进程
        match self.process_manager.spawn(&terminal_id, cmd, &self.working_dir).await {
            Ok(handle) => {
                // 更新终端状态
                let _ = terminal_dao::set_terminal_started(&self.db.pool, &terminal_id).await;
                let _ = terminal_dao::update_terminal_process(
                    &self.db.pool,
                    &terminal_id,
                    Some(handle.pid as i32),
                    Some(&handle.session_id),
                ).await;

                tracing::info!("Terminal {} started with PID {}", terminal_id, handle.pid);

                LaunchResult {
                    terminal_id,
                    process_handle: Some(handle),
                    success: true,
                    error: None,
                }
            }
            Err(e) => {
                tracing::error!("Failed to start terminal {}: {}", terminal_id, e);
                LaunchResult {
                    terminal_id,
                    process_handle: None,
                    success: false,
                    error: Some(format!("Process spawn failed: {}", e)),
                }
            }
        }
    }

    /// 构建启动命令
    fn build_launch_command(&self, cli_name: &str) -> Command {
        let mut cmd = match cli_name {
            "claude-code" => {
                let mut c = Command::new("claude");
                c.arg("--dangerously-skip-permissions");
                c
            }
            "gemini-cli" => Command::new("gemini"),
            "codex" => Command::new("codex"),
            "amp" => Command::new("amp"),
            "cursor-agent" => Command::new("cursor"),
            _ => Command::new(cli_name),
        };

        cmd.current_dir(&self.working_dir);
        cmd.kill_on_drop(true);

        cmd
    }

    /// 停止所有终端
    pub async fn stop_all(&self, workflow_id: &str) -> anyhow::Result<()> {
        let terminals = terminal_dao::get_terminals_by_workflow(&self.db.pool, workflow_id).await?;

        for terminal in terminals {
            if let Some(pid) = terminal.process_id {
                self.process_manager.kill(pid as u32).await?;
            }
            terminal_dao::update_terminal_status(&self.db.pool, &terminal.id, "cancelled").await?;
        }

        Ok(())
    }
}
```

---

**交付物:** `terminal/mod.rs`, `terminal/launcher.rs`

---

### Task 4.2: 实现进程管理

**状态:** ⬜ 未开始

**涉及文件:**
- 创建: `vibe-kanban-main/crates/services/src/services/terminal/process.rs`

---

**Step 4.2.1: 创建 process.rs**

```rust
//! 进程管理

use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::process::{Command, Child};
use tokio::sync::RwLock;
use uuid::Uuid;

/// 进程句柄
#[derive(Debug)]
pub struct ProcessHandle {
    pub pid: u32,
    pub session_id: String,
    pub terminal_id: String,
}

/// 进程管理器
pub struct ProcessManager {
    processes: Arc<RwLock<HashMap<String, Child>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self { processes: Arc::new(RwLock::new(HashMap::new())) }
    }

    /// 启动进程
    pub async fn spawn(
        &self,
        terminal_id: &str,
        mut cmd: Command,
        working_dir: &Path,
    ) -> anyhow::Result<ProcessHandle> {
        cmd.current_dir(working_dir);

        // 配置标准输入输出
        cmd.stdin(std::process::Stdio::piped());
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        let child = cmd.spawn()?;
        let pid = child.id().unwrap_or(0);
        let session_id = Uuid::new_v4().to_string();

        let mut processes = self.processes.write().await;
        processes.insert(terminal_id.to_string(), child);

        Ok(ProcessHandle {
            pid,
            session_id,
            terminal_id: terminal_id.to_string(),
        })
    }

    /// 终止进程
    pub async fn kill(&self, pid: u32) -> anyhow::Result<()> {
        #[cfg(unix)]
        {
            use nix::sys::signal::{kill, Signal};
            use nix::unistd::Pid;
            let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
        }

        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .output();
        }

        Ok(())
    }

    /// 检查进程是否运行
    pub async fn is_running(&self, terminal_id: &str) -> bool {
        let processes = self.processes.read().await;
        if let Some(child) = processes.get(terminal_id) {
            child.id().is_some()
        } else {
            false
        }
    }

    /// 获取所有运行中的进程
    pub async fn list_running(&self) -> Vec<String> {
        let processes = self.processes.read().await;
        processes.keys().cloned().collect()
    }

    /// 清理已结束的进程
    pub async fn cleanup(&self) {
        let mut processes = self.processes.write().await;
        processes.retain(|_, child| child.id().is_some());
    }
}

impl Default for ProcessManager {
    fn default() -> Self { Self::new() }
}
```

---

**交付物:** `terminal/process.rs`

---

### Task 4.3: 实现 CLI 检测服务

**状态:** ⬜ 未开始

**涉及文件:**
- 创建: `vibe-kanban-main/crates/services/src/services/terminal/detector.rs`

---

**Step 4.3.1: 创建 detector.rs**

```rust
//! CLI 检测服务

use std::sync::Arc;
use tokio::process::Command;
use db::DBService;
use db::models::{CliType, CliDetectionStatus, cli_type_dao};

/// CLI 检测器
pub struct CliDetector {
    db: Arc<DBService>,
}

impl CliDetector {
    pub fn new(db: Arc<DBService>) -> Self {
        Self { db }
    }

    /// 检测所有 CLI
    pub async fn detect_all(&self) -> anyhow::Result<Vec<CliDetectionStatus>> {
        let cli_types = cli_type_dao::get_all_cli_types(&self.db.pool).await?;
        let mut results = Vec::new();

        for cli_type in cli_types {
            let status = self.detect_single(&cli_type).await;
            results.push(status);
        }

        Ok(results)
    }

    /// 检测单个 CLI
    pub async fn detect_single(&self, cli_type: &CliType) -> CliDetectionStatus {
        let parts: Vec<&str> = cli_type.detect_command.split_whitespace().collect();

        if parts.is_empty() {
            return self.not_installed(cli_type);
        }

        let cmd = parts[0];
        let args = &parts[1..];

        match Command::new(cmd).args(args).output().await {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|s| s.trim().to_string());

                let executable_path = self.find_executable(cmd).await;

                CliDetectionStatus {
                    cli_type_id: cli_type.id.clone(),
                    name: cli_type.name.clone(),
                    display_name: cli_type.display_name.clone(),
                    installed: true,
                    version,
                    executable_path,
                    install_guide_url: cli_type.install_guide_url.clone(),
                }
            }
            _ => self.not_installed(cli_type),
        }
    }

    fn not_installed(&self, cli_type: &CliType) -> CliDetectionStatus {
        CliDetectionStatus {
            cli_type_id: cli_type.id.clone(),
            name: cli_type.name.clone(),
            display_name: cli_type.display_name.clone(),
            installed: false,
            version: None,
            executable_path: None,
            install_guide_url: cli_type.install_guide_url.clone(),
        }
    }

    async fn find_executable(&self, cmd: &str) -> Option<String> {
        #[cfg(unix)]
        {
            Command::new("which").arg(cmd).output().await.ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        }

        #[cfg(windows)]
        {
            Command::new("where").arg(cmd).output().await.ok()
                .filter(|o| o.status.success())
                .map(|o| String::from_utf8_lossy(&o.stdout).lines().next().unwrap_or("").to_string())
        }
    }

    /// 检测指定 CLI 是否可用
    pub async fn is_available(&self, cli_name: &str) -> bool {
        if let Ok(Some(cli_type)) = cli_type_dao::get_cli_type_by_name(&self.db.pool, cli_name).await {
            let status = self.detect_single(&cli_type).await;
            status.installed
        } else {
            false
        }
    }
}
```

---

**交付物:** `terminal/detector.rs`

**验收标准:**
1. 编译通过
2. CLI 检测功能正常工作

---

## Phase 4 完成检查清单

- [ ] Task 4.1: TerminalLauncher 实现完成
- [ ] Task 4.2: ProcessManager 实现完成
- [ ] Task 4.3: CliDetector 实现完成

---
