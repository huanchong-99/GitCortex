# Phase 11: 单项目结构迁移（一次性迁移计划）

> **状态:** ⬜ 未开始  
> **前置条件:** 设计/实施文档已完整审计  
> **原则:** 一次性迁移，迁移完成后再修复  
> **范围:** 仅保留运行/构建/测试必需内容；不保留上游文档类文件

---

## 目标

- 将 `vibe-kanban-main` 与 `cc-switch-main` 融合为单一项目结构。
- 删除原项目中在本项目内不使用的内容。
- 保留并迁入已被 GitCortex 集成的必要模块（尤其是 cc-switch 相关）。
- 迁移完成后再进入修复与验证阶段。

---

## 迁移范围（冻结清单）

### 保留（从 `vibe-kanban-main` 迁入）

- 代码与运行核心：`crates/`, `frontend/`, `shared/`, `assets/`, `scripts/`, `tests/`
- 构建与工具链：`.cargo/`, `Cargo.toml`, `Cargo.lock`, `pnpm-workspace.yaml`,
  `package.json`, `pnpm-lock.yaml`, `.npmrc`, `rust-toolchain.toml`,
  `rustfmt.toml`, `clippy.toml`

### 删除（不迁入）

- 上游文档类文件：`vibe-kanban-main/README.md`, `vibe-kanban-main/LICENSE`,
  `vibe-kanban-main/.gitignore`, `vibe-kanban-main/AGENTS.md`, `vibe-kanban-main/docs`,
  `vibe-kanban-main/CODE-OF-CONDUCT.md`
- 远程部署/发布相关：`vibe-kanban-main/remote-frontend`, `vibe-kanban-main/crates/remote`,
  `vibe-kanban-main/npx-cli`
- 非 MVP 必需：`vibe-kanban-main/dev_assets_seed`, `vibe-kanban-main/Dockerfile`,
  `vibe-kanban-main/local-build.sh`, `vibe-kanban-main/package-lock.json`,
  `vibe-kanban-main/test_security_fix.sh`

### cc-switch-main 补齐（按需迁入）

如 `crates/cc-switch` 缺失以下能力，则从 `cc-switch-main/src-tauri/src` 迁入并整合：

- `provider.rs`（Provider 数据模型）
- `config.rs`（Claude 配置读写）
- `codex_config.rs`（Codex 配置读写）
- `gemini_config.rs`（Gemini 配置读写）
- `services/provider/*`（Provider 服务与 live 写入）

---

## 任务拆分（一次性迁移）

### Task 11.1: 冻结迁移清单（Keep/Drop/补齐）

**目标:** 输出最终迁移映射表与保留/删除清单  
**步骤:**
1. 全量扫描 `vibe-kanban-main` 与 `cc-switch-main` 的引用关系（`rg`）。
2. 确认保留与删除目录清单，标注 cc-switch 必需模块。
3. 形成迁移映射（来源 -> 目标）。
**交付物:** 迁移映射表、最终清单  
**验收标准:** 清单可直接执行且通过确认

---

### Task 11.2: cc-switch-main 必要模块补齐迁入

**目标:** 补齐 GitCortex 已集成但 `crates/cc-switch` 缺失的能力  
**涉及路径:** `cc-switch-main/src-tauri/src/*`, `crates/cc-switch/src/*`  
**步骤:**
1. 对比 `cc-switch-main/src-tauri/src` 与 `crates/cc-switch/src` 能力覆盖。
2. 迁入缺失模块并完成最小整合（入口、导出、依赖整理）。
3. 确保 `rg -n "cc-switch-main"` 无残留引用。
**交付物:** 补齐后的 `crates/cc-switch`  
**验收标准:** 所需模块已迁入且代码可被引用（暂不修复编译错误）

---

### Task 11.3: 一次性迁移核心目录与配置

**目标:** 将保留清单中的目录与文件一次性迁入根目录  
**步骤:**
1. 批量移动 `vibe-kanban-main` 保留目录至根目录。
2. 批量移动必要配置文件至根目录（避免覆盖 GitCortex 现有文件）。
3. 若冲突，保留 GitCortex 根目录版本，记录差异（迁移后再处理）。
**交付物:** 根目录形成单项目结构  
**验收标准:** 根目录包含 `crates/`, `frontend/`, `shared/`, `assets/`, `scripts/`, `tests/`

---

### Task 11.4: 路径与工作区配置重写

**目标:** 移除旧路径与被删除模块的配置引用  
**涉及文件:** `Cargo.toml`, `pnpm-workspace.yaml`, `package.json`, `scripts/*`  
**步骤:**
1. 从 `Cargo.toml` workspace 成员中移除 `crates/remote`。
2. 从 `pnpm-workspace.yaml` 移除 `remote-frontend`。
3. 从 `package.json` 移除 `npx-cli` 相关 `bin`/`files` 与脚本引用。
4. 全量搜索清理 `vibe-kanban-main`/`cc-switch-main` 路径残留。
**交付物:** 更新后的工作区与脚本配置  
**验收标准:** `rg -n "vibe-kanban-main|cc-switch-main"` 无结果

---

### Task 11.5: 删除不需要模块/目录

**目标:** 删除非 MVP 目录与上游项目残留  
**步骤:**
1. 删除 `remote-frontend`、`npx-cli`、`dev_assets_seed`、上游 `docs` 与杂项文件。
2. 确认无被运行链路引用的目录残留。
**交付物:** 精简后的单项目目录  
**验收标准:** 删除清单目录全部不存在

---

### Task 11.6: 删除源目录（最终收口）

**目标:** 删除 `vibe-kanban-main` 与 `cc-switch-main`  
**步骤:**
1. 再次确认核心目录已迁入根目录。
2. 删除 `vibe-kanban-main` 与 `cc-switch-main`。
**交付物:** 根目录仅保留单项目结构  
**验收标准:** 根目录无 `vibe-kanban-main`/`cc-switch-main`

---

## 迁移后修复清单（不在本阶段执行）

- 统一修复路径与导入，恢复构建与运行。
- 清理遗留前端页面/后端路由，仅保留 MVP 目标功能。
- 运行 `pnpm run check` 与 `cargo test --workspace` 并集中修复问题。
- 更新根目录 README（仅保留 GitCortex 自有内容）。

