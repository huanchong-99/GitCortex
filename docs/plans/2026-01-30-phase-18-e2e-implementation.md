# Phase 18 端到端测试实施计划

> **创建时间:** 2026-01-30
> **工作区:** E:/GitCortex-phase-18-e2e
> **分支:** feature/phase-18-e2e-tests

## 概述

基于 Codex MCP 分析，实施 Phase 18 的端到端测试，覆盖完整的工作流生命周期。

## Task 18.1 - 端到端全流程测试

### 关键路径覆盖

1. **Workflow 创建验证**
   - 任务为空/终端为空时返回错误
   - CLI 或 model 不存在时返回错误
   - CLI-model 不匹配时返回错误
   - 分支名去重（`workflow/{id}/{slug}-2`）

2. **状态转换验证**
   - 非 ready 状态时 start 返回错误
   - merge 在 created/ready 状态下失败
   - 状态流：created → ready → starting → running → completed

3. **Happy Path E2E**
   - create → ready → start → Git commit detection → LLM 完成 → merge

### 测试用例

| 测试名称 | 描述 |
|---------|------|
| `test_workflow_create_validation` | 验证创建时的各种校验 |
| `test_workflow_status_transitions` | 验证状态转换规则 |
| `test_workflow_full_lifecycle_e2e` | 完整生命周期测试 |
| `test_workflow_branch_naming` | 分支命名去重测试 |

## Task 18.2 - 并发/失败/恢复场景测试

### 测试用例

| 测试名称 | 描述 |
|---------|------|
| `test_concurrent_workflow_limit` | 并发 workflow 超限拒绝 |
| `test_concurrent_start_same_workflow` | 同一 workflow 并发 start |
| `test_terminal_failed_commit` | 终端失败后状态更新 |
| `test_llm_network_failure` | LLM API 500/超时重试 |
| `test_workflow_recovery` | 恢复中断的 workflow |

## 测试基础设施

### Mock 策略

1. **LLM API**: 使用 `wiremock` mock `/chat/completions`
2. **CLI 工具**: 避免真实 CLI，通过 GitWatcher 触发 commit event
3. **测试数据库**: SQLite in-memory + `sqlx::migrate!`
4. **Git 提交事件**: 临时 repo + `git commit -m` 写入 `---METADATA---`

### 环境变量

```bash
GITCORTEX_ENCRYPTION_KEY=12345678901234567890123456789012
```

## 实施步骤

### Step 1: 添加测试依赖
- [x] 添加 `wiremock` 到 server/Cargo.toml dev-dependencies

### Step 2: 创建测试辅助函数
- [ ] `init_repo()` - 初始化临时 git 仓库
- [ ] `commit_with_metadata()` - 创建带 metadata 的 commit
- [ ] `setup_seed_data()` - 设置测试数据
- [ ] `create_ready_workflow()` - 创建就绪状态的 workflow

### Step 3: 实现 Task 18.1 测试
- [ ] `test_workflow_create_validation`
- [ ] `test_workflow_status_transitions`
- [ ] `test_workflow_full_lifecycle_e2e`

### Step 4: 实现 Task 18.2 测试
- [ ] `test_concurrent_workflow_limit`
- [ ] `test_terminal_failed_commit`
- [ ] `test_llm_network_failure`
- [ ] `test_workflow_recovery`

### Step 5: 验证与清理
- [ ] 运行所有测试
- [ ] 修复失败的测试
- [ ] 提交代码

## 文件结构

```
crates/server/tests/
├── phase18_e2e_workflow.rs      # E2E 全流程测试
└── phase18_scenarios.rs         # 并发/失败/恢复场景测试

crates/services/tests/
└── phase18_scenarios.rs         # 服务层场景测试
```
