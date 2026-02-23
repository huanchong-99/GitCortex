# Git Watcher 使用指南

Git Watcher 模块监控 Git 仓库的提交事件，解析结构化提交信息，并触发 Orchestrator 工作流。

## 提交消息格式

Git Watcher 期望提交消息遵循以下格式：

```
[Terminal:{terminal_id}] [Status:{status}] {summary}

{optional body}

---METADATA---
workflow_id: {workflow_id}
task_id: {task_id}
terminal_id: {terminal_id}
terminal_order: {order}
cli: {cli_name}
model: {model_name}
status: {status}
next_action: {action}
```

### 示例

```
[Terminal:t1] [Status:completed] Implement user authentication

Added JWT-based authentication with refresh tokens.

---METADATA---
workflow_id: wf_abc123
task_id: task_def456
terminal_id: t1
terminal_order: 0
cli: claude-code
model: sonnet
status: completed
next_action: review
```

## 状态值

- `completed` - 任务成功完成
- `review_pass` - 代码审核通过
- `review_reject` - 代码审核未通过
- `failed` - 任务失败

## API 使用

### 启动 Git Watcher

```rust
use services::git_watcher::GitWatcher;
use services::orchestrator::MessageBus;
use std::sync::Arc;

let message_bus = Arc::new(MessageBus::new(1000));
let repo_path = std::path::PathBuf::from("/path/to/repo");
let workflow_id = "my_workflow".to_string();

let watcher = GitWatcher::new(repo_path, message_bus, workflow_id);
watcher.start().await?;
```

### 处理 Git 事件

```rust
use services::git_watcher::GitEventHandler;
use db::DBService;

let handler = GitEventHandler::new(db, message_bus);

// 当 Git 事件被检测到时，handler 会自动：
// 1. 解析提交消息
// 2. 保存到数据库
// 3. 更新终端状态
// 4. 发布 TerminalCompletionEvent 到消息总线
```

### 解析提交消息

```rust
use services::git_watcher::CommitParser;

let parsed = CommitParser::parse(commit_message)?;

if let Some(parsed) = parsed {
    println!("Terminal: {}", parsed.terminal_id);
    println!("Status: {}", parsed.status);
    println!("Workflow: {}", parsed.metadata.workflow_id);
}
```

## 数据库表

### git_event 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | UUID |
| workflow_id | TEXT | 工作流 ID |
| terminal_id | TEXT | 终端 ID (可选) |
| commit_hash | TEXT | Git commit hash |
| branch | TEXT | 分支名称 |
| commit_message | TEXT | 完整提交消息 |
| metadata | TEXT | JSON 格式的元数据 |
| process_status | TEXT | pending/processed/failed |
| agent_response | TEXT | 主 Agent 响应 (JSON) |
| created_at | TIMESTAMP | 创建时间 |
| processed_at | TIMESTAMP | 处理时间 |

### terminal 表更新

当 Git 事件被处理时，对应的 terminal 记录会更新：
- `last_commit_hash` - 最新的 commit hash
- `last_commit_message` - 最新的提交消息

## 工作流集成

Git Watcher 与 Orchestrator 集成的工作流：

1. **提交检测**: Watcher 检测到 `.git/refs/heads` 下的文件变化
2. **提交获取**: 使用 `git log` 获取最新提交信息
3. **消息解析**: CommitParser 提取结构化元数据
4. **数据库记录**: 创建 GitEvent 记录
5. **终端更新**: 更新 Terminal 的 last_commit 信息
6. **事件发布**: 发布 TerminalCompletionEvent 到消息总线
7. **Orchestrator 响应**: 主 Agent 接收事件并决定下一步操作

## 监控和调试

启用 tracing 日志：

```rust
tracing_subscriber::fmt()
    .with_max_level(tracing::Level::DEBUG)
    .init();
```

关键日志：
- `Git watcher started for {path}` - Watcher 启动
- `Handling git event: {hash} on {branch}` - 事件处理
- `Commit message not in expected format, skipping` - 跳过非结构化提交

## 错误处理

- 非 Git 仓库路径会返回错误
- 无效的提交格式会被跳过（不会中断服务）
- Git 命令失败会记录错误日志
