# Phase 20 TDD 实施计划

> **创建日期:** 2026-02-04
> **状态:** 🔄 进行中
> **Codex 协作:** 已完成需求分析和代码原型审阅

---

## 1. 实施顺序（TDD）

### Step 1: state.rs 新增方法
- [ ] `advance_terminal(&mut self, task_id: &str) -> bool` - 推进终端索引，返回是否还有下一个
- [ ] `get_next_terminal_for_task(&self, task_id: &str) -> Option<usize>` - 获取下一个待执行终端索引
- [ ] `is_task_completed(&self, task_id: &str) -> bool` - 检查任务是否完成

### Step 2: tests.rs 新增测试
- [ ] `setup_workflow_with_terminals` - 测试辅助函数
- [ ] `test_execute_instruction_start_task` - StartTask 指令执行测试
- [ ] `test_execute_instruction_start_task_no_pty` - PTY 未就绪错误路径测试
- [ ] `test_auto_dispatch_first_terminal` - 自动派发首个终端测试
- [ ] `test_terminal_completed_advances_to_next` - 终端完成后推进到下一终端测试

### Step 3: agent.rs 新增方法
- [ ] `dispatch_terminal` - 派发终端到 PTY 会话
- [ ] `build_task_instruction` - 构建任务指令文本
- [ ] `auto_dispatch_initial_tasks` - 自动派发初始任务

### Step 4: agent.rs 修改现有方法
- [ ] `execute_instruction` 添加 `StartTask` 处理
- [ ] `handle_terminal_completed` 添加推进到下一终端的逻辑
- [ ] `run()` 添加自动派发调用

---

## 2. Codex 代码原型审阅意见

### 2.1 需要修正的问题

| 问题 | Codex 原型 | 修正方案 |
|------|-----------|----------|
| `advance_terminal` 返回值 | 返回 `Option<usize>` | 改为返回 `bool`，表示是否还有下一个 |
| 幂等性检查 | 无 | 添加 `dispatched_terminals: HashSet<String>` 防止重复派发 |
| 状态检查 | 只检查 `Waiting` | 添加更完整的状态检查 |

### 2.2 保留的设计

- 使用 DB 模型的状态枚举 (`TerminalStatus::Waiting/Working`)
- `dispatch_terminal` 方法的基本结构
- 测试辅助函数 `setup_workflow_with_terminals`

---

## 3. 状态常量对齐

| 场景 | 使用的状态 |
|------|-----------|
| 终端等待派发 | `TerminalStatus::Waiting` |
| 终端正在执行 | `TerminalStatus::Working` |
| 终端完成 | `TerminalStatus::Completed` |
| 终端失败 | `TerminalStatus::Failed` |
| 任务运行中 | `WorkflowTaskStatus::Running` |
| 任务完成 | `WorkflowTaskStatus::Completed` |
| 任务失败 | `WorkflowTaskStatus::Failed` |

---

## 4. 验收标准

- [ ] 所有 4 个新测试通过
- [ ] 现有测试不受影响
- [ ] `cargo clippy` 无新警告
- [ ] `cargo test` 全部通过
