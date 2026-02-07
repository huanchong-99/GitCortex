# codex项目完整分析（23 Agent 并行审计）

## 审计说明
- 审计目标：仅识别**直接 Bug**与**逻辑问题（代码可运行但功能无法实现）**，不提供修复方案。
- 审计范围：`frontend/src`、`crates/*/src`、`shared/types.ts`、`tests`、`scripts`（与业务链路相关部分）。
- 审计方式：先全局拆分模块，再以子 Agent 并行审计，最后进行跨模块复核。

## Agent 分工（按你的要求）

### 前端工程师（5）
- FE-1：Workflow 向导/流程页（`components/workflow`、`components/wizard`、`pages/Workflows*`）。
- FE-2：任务/看板/管线（`components/tasks`、`components/board`、`components/pipeline`）。
- FE-3：终端/日志/Diff 面板（`components/terminal`、`components/panels`、`stores/wsStore.ts`）。
- FE-4：新 UI 容器层与上下文（`components/ui-new`、`contexts`、`pages/ui-new`）。
- FE-5：前端基础设施（`lib`、`utils`、`keyboard`、`settings` 相关）。

### 后端工程师（8）
- BE-1：`server` 基础层与容器相关路由。
- BE-2：`workflows/tasks/task_attempts` 路由层。
- BE-3：`terminals/ws/events/subscription_hub`。
- BE-4：`services/orchestrator/events/terminal`。
- BE-5：`services/config/git/git_host`。
- BE-6：`db models + migrations`。
- BE-7：`executors`。
- BE-8：`cc-switch/review/deployment/utils`。

### 全栈工程师（10）
- FS-1：Workflow 端到端链路。
- FS-2：Task/Attempt 生命周期链路。
- FS-3：Terminal/Execution/WS 链路。
- FS-4：Git/Repo/Project/Organization 链路。
- FS-5：Model/MCP/Executor 配置链路。
- FS-6：Slash Commands 链路。
- FS-7：Filesystem/IDE 打开链路。
- FS-8：事件总线/订阅链路。
- FS-9：共享类型/契约/测试覆盖失配。
- FS-10（额外指定）：**跨模块组合审计专员**（多模块联动问题）。

## 额外验证
- 执行了 `pnpm -C frontend run check`，确认当前仓库存在可复现的前端类型检查失败（见下文缺陷清单）。

---

## 缺陷清单（仅问题与原因）

## A. 阻断级（直接导致功能失败/链路中断）

- **[逻辑问题] Workflow Step4 校验错误键不一致，用户被卡死且无错误提示**
  - 位置：`frontend/src/components/workflow/steps/Step4Terminals.tsx:349`、`frontend/src/components/workflow/steps/Step4Terminals.tsx:375`、`frontend/src/components/workflow/validators/step4Terminals.ts:16`、`frontend/src/components/workflow/validators/step4Terminals.ts:19`
  - 原因：校验器按 `terminal-${index}` 写错误，UI 按 `terminal-${terminal.id}` 读错误。
  - 结果：下一步被阻止，但界面不显示真实报错。

- **[逻辑问题] 多任务 Workflow 只初始化“当前任务终端”，提交时直接失败**
  - 位置：`frontend/src/components/workflow/steps/Step4Terminals.tsx:81`、`frontend/src/components/workflow/types.ts:249`、`frontend/src/components/workflow/types.ts:254`
  - 原因：Step4 仅对当前任务补终端；序列化时要求每个任务必须有终端。
  - 结果：多任务场景不逐个切换配置会抛错并无法创建。

- **[直接 Bug] DiffsPanel 在 render 阶段 setState，触发渲染抖动/循环风险**
  - 位置：`frontend/src/components/panels/DiffsPanel.tsx:70`、`frontend/src/components/panels/DiffsPanel.tsx:92`
  - 原因：渲染路径中直接调用 `setLoadingState/setProcessedIds/setCollapsedIds`。
  - 结果：StrictMode 下更易出现重复渲染、性能劣化，极端情况下界面不可用。

- **[跨模块逻辑] 停止 Workflow 仅停 Orchestrator，不停终端进程（资源泄漏）**
  - 位置：`crates/server/src/routes/workflows.rs:880`、`crates/server/src/routes/workflows.rs:925`、`crates/services/src/services/orchestrator/runtime.rs:326`、`crates/services/src/services/terminal/launcher.rs:515`
  - 原因：`stop_workflow` 只更新状态和停止编排线程，未统一调用终端停机逻辑。
  - 结果：UI 显示已取消，但终端/日志仍继续跑。

- **[跨模块逻辑] Workflow merge 接口只改状态，不执行真实合并**
  - 位置：`crates/server/src/routes/workflows.rs:1046`、`crates/server/src/routes/workflows.rs:1066`
  - 原因：路由返回“Merge completed successfully”，但未调用任何 Git merge 执行链路。
  - 结果：状态显示 completed，代码实际未合并。

- **[跨模块逻辑] Terminal 状态枚举前后端不一致，详情页存在崩溃风险**
  - 位置：`frontend/src/components/workflow/TerminalCard.tsx:7`、`frontend/src/components/workflow/TerminalCard.tsx:71`、`frontend/src/pages/Workflows.tsx:103`、`crates/server/src/routes/workflows.rs:925`、`crates/services/src/services/orchestrator/agent.rs:497`
  - 原因：后端会写 `cancelled/review_passed/review_rejected`，前端 `TerminalStatus` 未覆盖。
  - 结果：状态样式索引可能为空，终端卡片渲染异常。

- **[跨模块逻辑] Review 事件被当作 workflow.status_changed 广播，事件语义错位**
  - 位置：`crates/services/src/services/orchestrator/agent.rs:502`、`crates/services/src/services/orchestrator/agent.rs:539`、`crates/server/src/routes/workflow_events.rs:131`
  - 原因：review pass/reject 发布为 `BusMessage::StatusUpdate`，网关映射到 WorkflowStatusChanged。
  - 结果：前端收到非法 workflow 状态值，终端级状态事件缺失。

- **[跨模块逻辑] WorkflowTask 未绑定 `vk_task_id`，导致终端无法绑定会话/执行进程链路**
  - 位置：`crates/server/src/routes/workflows.rs:461`、`crates/services/src/services/terminal/launcher.rs:486`、`crates/services/src/services/terminal/launcher.rs:495`
  - 原因：创建 workflow task 时 `vk_task_id` 固定 `None`，而终端会话链路依赖它查询 workspace。
  - 结果：终端记录可能无 `session_id/execution_process_id`，影响日志与尝试链路。

- **[跨模块逻辑] 创建 task attempt 时容器启动失败被吞掉，接口仍返回成功**
  - 位置：`crates/server/src/routes/task_attempts.rs:228`、`crates/server/src/routes/task_attempts.rs:233`
  - 原因：`start_workspace` 失败仅写日志，不向调用方返回错误。
  - 结果：前端以为 attempt 已可用，但实际上无运行上下文。

- **[逻辑问题] Follow-up 输入被 `processes.length===0` 强制禁用，失败态无法自救**
  - 位置：`frontend/src/components/tasks/TaskFollowUpSection.tsx:360`、`frontend/src/components/tasks/TaskFollowUpSection.tsx:362`
  - 原因：无 process 即禁止输入，即使用户想通过 follow-up 触发恢复也被阻断。
  - 结果：出现 attempt 卡死后无法继续操作。

- **[逻辑问题] `createTask` 后强跳 `attempts/latest`，但普通创建并不创建 attempt**
  - 位置：`frontend/src/hooks/useTaskMutations.ts:28`、`frontend/src/hooks/useTaskMutations.ts:41`、`crates/server/src/routes/tasks.rs:109`、`crates/server/src/routes/tasks.rs:121`
  - 原因：前端导航假设与后端行为不一致。
  - 结果：跳转空页/404 风险，流程断裂。

- **[逻辑问题] Slash Command 新建校验前后端不一致（description）**
  - 位置：`frontend/src/pages/SlashCommands.tsx:205`、`frontend/src/pages/SlashCommands.tsx:217`、`crates/server/src/routes/slash_commands.rs:92`
  - 原因：前端不强制 description，后端强制非空。
  - 结果：UI 可提交但后端必拒绝。

- **[逻辑问题] Slash Command “重命名命令名”无效**
  - 位置：`frontend/src/pages/SlashCommands.tsx:217`、`crates/server/src/routes/slash_commands.rs:171`
  - 原因：前端可编辑 `command`，后端更新 SQL 不更新 `command` 列。
  - 结果：用户操作无效，功能不可达。

- **[接口契约问题] Open Editor 请求字段前后端不一致**
  - 位置：`shared/types.ts:255`、`crates/server/src/routes/projects.rs:362`、`crates/server/src/routes/repo.rs:126`
  - 原因：共享类型使用 `file_path`，项目路由读取 `git_repo_path`，repo 路由忽略路径参数直接打开仓库根。
  - 结果：指定文件打开能力失效/行为不一致。

- **[逻辑问题] `containers/attempt-context` 仅精确匹配，子目录 ref 无法解析**
  - 位置：`crates/server/src/routes/containers.rs:49`
  - 原因：未使用按前缀回退的解析逻辑。
  - 结果：扩展/客户端在子路径场景拿不到上下文。

- **[错误语义问题] 容器查询 not found 被映射为 500**
  - 位置：`crates/server/src/routes/containers.rs:33`、`crates/server/src/routes/containers.rs:62`
  - 原因：统一 `ApiError::Database`，未区分 RowNotFound。
  - 结果：客户端误判服务器异常，重试与提示逻辑失真。

- **[直接 Bug] Terminal WS 接收超时会主动断开“只读会话”**
  - 位置：`crates/server/src/routes/terminal_ws.rs:407`、`crates/server/src/routes/terminal_ws.rs:481`、`crates/server/src/routes/terminal_ws.rs:505`
  - 原因：`ws_receiver.next()` 固定超时后直接 break，随后 select 终止整条连接。
  - 结果：即便终端持续输出、用户不输入，连接仍被误断。

- **[逻辑问题] `POST /terminals/:id/stop` 对不存在 id 仍返回成功**
  - 位置：`crates/server/src/routes/terminals.rs:435`、`crates/server/src/routes/terminals.rs:448`
  - 原因：不校验 terminal 是否存在，0 行更新也被当成功。
  - 结果：调用方误判成功，问题被掩盖。

- **[直接 Bug] 任务列表查询把可空 executor 当非空解码，可能直接 500**
  - 位置：`crates/db/src/models/task.rs:181`、`crates/db/src/models/task.rs:187`
  - 原因：SQLx 别名 `executor!: String` 强制非空，但子查询可返回 NULL。
  - 结果：某些任务列表接口直接失败。

## B. 高优先逻辑问题（非瞬时崩溃，但会长期导致功能不可实现/状态错误）

- **[逻辑问题] `useWorkflowEvents` 卸载时无条件 `disconnect`，多订阅者互相断流**
  - 位置：`frontend/src/stores/wsStore.ts:384`、`frontend/src/stores/wsStore.ts:388`
  - 原因：共享连接缺少引用计数管理。
  - 结果：一个组件卸载，其他订阅组件也断开。

- **[逻辑问题] WS Store 全局单连接，不同 workflow 订阅会互相覆盖**
  - 位置：`frontend/src/stores/wsStore.ts:86`、`frontend/src/stores/wsStore.ts:99`、`frontend/src/stores/wsStore.ts:107`
  - 原因：`currentWorkflowId + _ws` 为单例模型。
  - 结果：跨 workflow 视图并存时出现错订阅/串线。

- **[契约缺失] 前端 `WsEventType` 未覆盖 `terminal.prompt_*` 事件**
  - 位置：`frontend/src/stores/wsStore.ts:17`、`crates/server/src/routes/workflow_events.rs:64`
  - 原因：后端产生日志提示事件，前端类型与处理链未接入。
  - 结果：prompt 检测/决策相关 UI 无法生效。

- **[逻辑问题] EventBridge 无订阅者时直接丢事件**
  - 位置：`crates/server/src/routes/event_bridge.rs:60`、`crates/server/src/routes/event_bridge.rs:62`
  - 原因：发布前强依赖 `has_subscribers`，无缓存/补偿。
  - 结果：重连/晚连客户端错过关键状态变更。

- **[逻辑问题] 广播 lagged 被吞掉，无重同步机制**
  - 位置：`crates/services/src/services/events/streams.rs:138`、`crates/services/src/services/events/streams.rs:347`
  - 原因：`Err(_) => None` 直接丢弃。
  - 结果：前端 patch 流出现永久缺口，状态长期不一致。

- **[逻辑问题] prepare 过程中部分终端失败只改 workflow=failed，未回滚已启动终端**
  - 位置：`crates/server/src/routes/workflows.rs:737`、`crates/server/src/routes/workflows.rs:745`
  - 原因：缺少已启动终端的统一清理。
  - 结果：出现“流程失败但进程还在跑”的悬挂态。

- **[逻辑问题] workflow task 状态接口允许 `in_progress`，与既有状态集不一致**
  - 位置：`crates/server/src/routes/workflows.rs:1002`、`crates/db/src/models/workflow.rs:79`
  - 原因：路由允许值超出 `WorkflowTaskStatus` 语义范围。
  - 结果：状态机与前端认知偏移，展示/统计异常。

- **[逻辑问题] 单仓库 `open-editor` + `file_path` 时路径拼接基目录错误**
  - 位置：`crates/server/src/routes/task_attempts.rs:616`、`crates/server/src/routes/task_attempts.rs:624`
  - 原因：只有无 `file_path` 才切到 repo 子目录；有 `file_path` 则从容器根拼接。
  - 结果：指定文件打不开或打开错误位置。

- **[逻辑问题] 合并单个 repo 后直接把任务置 Done 并归档 workspace**
  - 位置：`crates/server/src/routes/task_attempts.rs:456`、`crates/server/src/routes/task_attempts.rs:472`
  - 原因：未校验同 workspace 其他 repo 的合并状态。
  - 结果：多 repo 任务提前“完成”，遗漏实际合并。

- **[逻辑问题] 删除任务后移除缓存 key 写错，陈旧详情会残留**
  - 位置：`frontend/src/hooks/useTaskMutations.ts:87`、`frontend/src/hooks/useTask.ts:7`
  - 原因：删除时移除 `['task', id]`，实际查询 key 为 `['tasks', id]`。
  - 结果：删除后短时出现旧数据闪回。

- **[逻辑问题] `useAttemptExecution` 在无 taskId 时共享空 key，停止态串扰**
  - 位置：`frontend/src/hooks/useAttemptExecution.ts:10`
  - 原因：`useTaskStopping(taskId || '')`。
  - 结果：一个 attempt 停止状态会污染其他 attempt 视图。

- **[逻辑问题] Task Follow-up 脚本入口恒为可用且忽略 Result 错误**
  - 位置：`frontend/src/components/tasks/TaskFollowUpSection.tsx:399`、`frontend/src/components/tasks/TaskFollowUpSection.tsx:404`
  - 原因：`hasAnyScript = true` 且返回 `Result` 未分支处理。
  - 结果：用户点击后可能“看似执行、实际未执行”。

- **[逻辑问题] ExecutionProcessesProvider 的 `attemptId` 参数未被使用**
  - 位置：`frontend/src/contexts/ExecutionProcessesContext.tsx:23`、`frontend/src/contexts/ExecutionProcessesContext.tsx:31`
  - 原因：Provider 仅按 `sessionId` 建流。
  - 结果：部分 attempt 视图缺 session 时执行进程链路不可用。

- **[逻辑问题] subscription_hub 在无订阅时 publish 仍创建 channel，可能累积泄漏**
  - 位置：`crates/server/src/routes/subscription_hub.rs:60`、`crates/server/src/routes/subscription_hub.rs:103`
  - 原因：`publish` 内部无条件 `get_or_create_sender`。
  - 结果：workflow id 多时通道表持续膨胀。

- **[逻辑问题] workspace 清理 SQL 对 NULL completed_at 处理不当，导致僵尸 workspace 不回收**
  - 位置：`crates/db/src/models/workspace.rs:362`、`crates/db/src/models/workspace.rs:364`
  - 原因：`max(datetime(w.updated_at), datetime(ep.completed_at))` 在 NULL 场景可能返回 NULL。
  - 结果：清理条件无法命中，容器长期残留。

- **[逻辑问题] execution_process 完成更新不写 `updated_at`**
  - 位置：`crates/db/src/models/execution_process.rs:520`
  - 原因：`update_completion` 仅更新 `status/exit_code/completed_at`。
  - 结果：依赖更新时间的排序/刷新逻辑失真。

- **[逻辑问题] `stream_raw_logs_ws` 升级前后各拉一次 raw stream**
  - 位置：`crates/server/src/routes/execution_processes.rs:46`、`crates/server/src/routes/execution_processes.rs:75`
  - 原因：预检查阶段创建流但未复用。
  - 结果：额外开销，若底层流不支持重复读取会出现日志异常风险。

- **[逻辑问题] Project Open Editor 接口允许任意 `git_repo_path`，缺乏项目范围约束**
  - 位置：`crates/server/src/routes/projects.rs:377`、`crates/server/src/routes/projects.rs:380`
  - 原因：客户端传入路径直接使用。
  - 结果：可打开项目外路径（越权风险）。

- **[逻辑问题] 远程编辑器 URL 未编码特殊字符**
  - 位置：`crates/services/src/services/config/editor/mod.rs:141`、`crates/services/src/services/config/editor/mod.rs:164`
  - 原因：`path` 直接拼接到 URL。
  - 结果：空格/特殊字符路径打开失败。

- **[逻辑问题] 远程文件是否追加 `:1:1` 用本地 `path.is_file()` 判断，不适配远程文件语义**
  - 位置：`crates/services/src/services/config/editor/mod.rs:161`
  - 原因：远程路径在本地 often 不存在，判断失真。
  - 结果：远程打开文件定位不稳定。

- **[逻辑问题] 组织/远程项目功能前后端脱节（页面有入口，后端统一 hard reject）**
  - 位置：`frontend/src/pages/settings/OrganizationSettings.tsx:55`、`crates/server/src/routes/organizations.rs:58`、`crates/server/src/routes/projects.rs:113`
  - 原因：后端组织相关接口直接返回“not supported”。
  - 结果：用户可进入但功能无法完成。

## C. 直接缺陷与兼容问题（实现错误/平台问题/契约不一致）

- **[直接 Bug] `pnpm -C frontend run check` 当前失败：ProjectSettings 更新类型不完整**
  - 位置：`frontend/src/pages/settings/ProjectSettings.tsx:302`、`shared/types.ts:31`
  - 原因：`UpdateProject` 要求 `defaultAgentWorkingDir`，调用只传 `name`。
  - 结果：前端类型检查失败。

- **[直接 Bug] 命令构造在空 base 场景可能 panic**
  - 位置：`crates/executors/src/command.rs:121`、`crates/executors/src/command.rs:123`、`crates/executors/src/command.rs:150`
  - 原因：非 Windows 分支 `split` 可能返回空数组后 `remove(0)`。
  - 结果：执行器在构建命令阶段崩溃。

- **[直接 Bug] 文本日志处理器在 time_gap 分支会丢弃当前 chunk**
  - 位置：`crates/executors/src/logs/plain_text_processor.rs:204`、`crates/executors/src/logs/plain_text_processor.rs:209`
  - 原因：先 flush 后 `return`，当前输入未入缓冲。
  - 结果：日志丢行。

- **[直接 Bug] review 会话选择索引偏移（带双 Skip 项）**
  - 位置：`crates/review/src/session_selector.rs:103`、`crates/review/src/session_selector.rs:105`、`crates/review/src/session_selector.rs:122`
  - 原因：插入头尾 Skip 后仍直接 `projects[selection]`。
  - 结果：选中错项目，末项可能越界。

- **[平台兼容 Bug] review 依赖 `which gh`，Windows 下误报未安装**
  - 位置：`crates/review/src/github.rs:91`
  - 原因：Windows 默认无 `which`。
  - 结果：GitHub 流程无法启动。

- **[平台兼容 Bug] cc-switch 原子写入在 Windows 目标文件已存在时可能失败**
  - 位置：`crates/cc-switch/src/atomic_write.rs:43`
  - 原因：`rename` 语义不覆盖已存在目标。
  - 结果：配置切换落盘失败。

- **[契约不一致] MCP 不支持错误文案匹配不一致，前端特殊分支失效**
  - 位置：`frontend/src/pages/settings/McpSettings.tsx:97`、`frontend/src/pages/settings/McpSettings.tsx:306`、`crates/server/src/routes/config.rs:241`、`crates/server/src/routes/config.rs:276`
  - 原因：前端只匹配 `does not support MCP`，后端返回两种不同文案。
  - 结果：错误提示路径与 UI 状态判断偏离。

- **[契约/引用错误] MCP 保存逻辑按对象引用找 profile key，重载后可能找不到**
  - 位置：`frontend/src/pages/settings/McpSettings.tsx:157`、`frontend/src/pages/settings/McpSettings.tsx:163`
  - 原因：`profiles[key] === selectedProfile` 依赖对象同一引用。
  - 结果：保存时报 “Selected profile key not found”。

- **[契约不一致] Workflow 状态枚举前端缺失 `merging`**
  - 位置：`frontend/src/hooks/useWorkflows.ts:16`、`crates/server/src/routes/workflows_dto.rs:349`
  - 原因：前端状态联合类型未包含后端有效状态。
  - 结果：状态动作映射回退、按钮逻辑错误。

- **[契约不一致] `TerminalDto.customApiKey` 被后端 skip_serializing，但 shared 类型要求存在**
  - 位置：`crates/server/src/routes/workflows_dto.rs:75`、`shared/types.ts:11`
  - 原因：类型生成未体现 `skip_serializing` 语义。
  - 结果：前端拿到 `undefined`，与 `null` 语义混淆。

---

## 审计结论
- 已按要求完成 23 名子 Agent 分工审计（5 前端 + 8 后端 + 10 全栈，含 1 名跨模块组合审计专员）。
- 当前代码中同时存在：
  - 多条“**可直接复现**”的实现缺陷（接口返回语义、错误处理、索引与状态机问题）；
  - 多条“**无编译报错但功能不可达**”的逻辑问题（流程链路断裂、跨模块状态不一致、事件流丢失）。
- 本文档仅记录问题与原因，不包含修复方案（符合你的要求）。

