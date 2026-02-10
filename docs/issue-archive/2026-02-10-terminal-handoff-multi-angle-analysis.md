# 2026-02-10 终端交接问题多角度分析记录

## 问题背景

在 workflow `e44a895b-f4da-412a-9e5d-7320c5593818` 的串行执行场景中，出现“终端1完成后，终端2启动时，终端1仍继续工作”的现象。

## 已观察到的现象

1. 终端交接后出现并发感：终端2已进入工作，但终端1仍有后续动作。
2. 存在“提示词已注入但未发送”或发送效果不稳定的反馈。
3. 前两个终端均为 Claude Code 时，用户观察到“上文一致，但下文分别继续”。

## 多角度候选根因（未定论）

### A. 编排状态机角度（高优先级）

- 完成判定依赖 `commit + quiet window`，但缺少“终端进程已停止”的硬性条件。
- 在该条件下，终端1可能被标记完成并触发终端2派发，但终端1进程仍继续运行。

### B. 发送链路角度（中高优先级）

- 发送受终端状态门槛与订阅时序影响，可能出现：
  - 注入动作发生，但发送被状态门槛拦截；
  - 发送/回车发生在桥接订阅未就绪时，导致消息丢弃；
  - topic/session 回退路径触发后，产生“看起来像串发”的体验。

### C. 会话绑定/上下文角度（中优先级）

- 设计上每终端应隔离会话，但若走到未完整隔离的启动路径，可能使用默认全局上下文。
- 这种情况下会出现“上文一致”的感知，同时又能各自继续下文开发。

### D. 组合问题可能性

- 当前更倾向于“多因素叠加”：
  - 完成判定与进程生命周期未完全闭环；
  - 发送链路在边界时序上有窗口；
  - 上下文隔离在特定启动路径下可能不一致。

## 当前结论

1. 问题尚未收敛到单一根因。
2. 不排除是多个 bug 组合形成。
3. 也保留“部分现象由观测角度导致错觉”的可能。
4. 本文档仅做问题归档与分析记录，不作为修复完成结论。

## 待后续确认项

1. 交接时是否已满足“终端进程停止”再推进。
2. 发送链路是否具备“订阅就绪确认 + 失败重试”。
3. 所有启动路径是否统一执行上下文隔离策略。
4. 是否存在同一完成事件的重复消费/重复派发。

## 第二轮深层分析追加（2026-02-10）

### 追加结论

1. 当前问题更像“组合问题”，并非单一缺陷。
2. 核心主因是：`terminal completed -> dispatch next` 流程没有“进程已停止”硬门槛，导致终端1可在被标记完成后继续运行。
3. 放大因子一是发送链路缺少订阅就绪 ACK，存在状态门槛与订阅时序窗口，导致注入未发送/延迟/错觉。
4. 放大因子二是 Workflows 页面状态更新不实时（未消费终端状态 WS + 非轮询），容易把显示状态误判为真实状态。
5. 启动隔离方面：`prepare_workflow` 与 `start_terminal` 当前均走 `cc_switch` 隔离路径，非主因；但 CLI 类型未识别时仍是边缘风险。

### 第二轮证据锚点

- 完成推进链路：`crates/services/src/services/orchestrator/agent.rs:178`
- 自动派发位置：`crates/services/src/services/orchestrator/agent.rs:370`
- quiet window 判定：`crates/services/src/services/orchestrator/agent.rs:477`
- completion 事件来源：`crates/services/src/services/git_watcher.rs:377`
- completion 事件发布：`crates/services/src/services/orchestrator/message_bus.rs:217`
- SendToTerminal 状态门槛：`crates/services/src/services/orchestrator/agent.rs:940`
- MessageBus 丢弃路径：`crates/services/src/services/orchestrator/message_bus.rs:164`
- TerminalInput 主/备 topic 回退：`crates/services/src/services/orchestrator/message_bus.rs:313`
- Bridge 订阅与路由：`crates/services/src/services/terminal/bridge.rs:190`
- Bridge 匹配规则：`crates/services/src/services/terminal/bridge.rs:260`
- Bridge 停止条件：`crates/services/src/services/terminal/bridge.rs:375`
- Workflows 状态来源：`frontend/src/pages/Workflows.tsx:399`
- Workflows 非实时刷新风险：`frontend/src/pages/Workflows.tsx:452`
- WS 终端状态事件定义：`frontend/src/stores/wsStore.ts:1425`
- Debug 页轮询对照：`frontend/src/pages/WorkflowDebugPage.tsx:34`

### 当前判断（追加）

- 单点修复不足以根治，需按“主因 -> 放大因子”顺序处理。
- 本追加仍为分析记录，不等同修复完成结论。

## 第三轮深层分析追加（2026-02-10）

### 追加目标

在第二轮基础上，刻意避开已覆盖方向（completed 硬门槛、发送 ACK、Workflows 非实时刷新）继续深挖，重点排查“之前未充分考虑”的系统层因素。

### 第三轮新增发现

1. 数据库并发一致性风险（高概率）
   - `dispatch_next_terminal` 与状态更新缺少事务/CAS/唯一约束保护，存在并发覆盖窗口。
   - 在并发条件下可能出现“终端1仍 working，同时终端2被启动”的状态并存。

2. 多实例/恢复双驱动风险（中高概率，取决部署）
   - runtime 去重主要为进程内内存级，跨实例共享同一 DB 时存在重复驱动可能。
   - `running` 状态恢复分支在多实例场景下可能触发并行驱动。

3. GitWatcher 事件源重放/误归属风险（中概率）
   - 当前为 `git log -1` 轮询，在 HEAD 切换、reset、force-push 等场景下存在再次识别或误归属风险。
   - metadata 解析边界较宽，存在误击中可能。

4. 伪终端“串台错觉”新方向（中概率）
   - 不是 WS 连接复用旧实例，而是 xterm 切换终端后未自动清屏，历史输出残留造成视觉串台。

### 第三轮证据锚点

- DB 并发窗口：`crates/services/src/services/orchestrator/agent.rs:539`
- dispatch 状态写入：`crates/services/src/services/orchestrator/agent.rs:1119`
- terminal 无条件状态更新：`crates/db/src/models/terminal.rs:396`
- workflow_task 无条件状态更新：`crates/db/src/models/workflow.rs:839`
- 多实例去重范围：`crates/services/src/services/orchestrator/runtime.rs:235`
- running 恢复分支：`crates/server/src/routes/workflows.rs:1157`
- GitWatcher 轮询入口：`crates/services/src/services/git_watcher.rs:234`
- GitWatcher hash 比较：`crates/services/src/services/git_watcher.rs:258`
- metadata 解析边界：`crates/services/src/services/git_watcher.rs:82`
- xterm 切换复用实例：`frontend/src/components/terminal/TerminalEmulator.tsx:85`
- WS 切换重建连接：`frontend/src/components/terminal/TerminalEmulator.tsx:132`

### 第三轮结论

- 第三轮继续支持“组合问题模型”，并新增了 DB 并发与多实例恢复层面的强证据。
- 目前仍不应下“单一根因”结论。
- 本节为分析归档，不代表修复已完成。

## 第四轮深层分析追加（2026-02-10）

### 追加目标

基于现有问题记录，继续分析“这些问题组合在一起会导致什么后果”，并挖掘前几轮未显式整理的新增问题清单。

### 组合后果（连锁故障）

1. 串行编排被破坏：终端1未真实停机时终端2已启动，形成并行执行与上下文分叉。
2. 指令可达性下降：注入成功但链路丢弃/错投，表现为“看起来发了但没有执行”。
3. 状态一致性破坏：workflow/task/terminal 出现状态分叉，导致恢复逻辑基于错误前提继续推进。
4. 事件重放放大：HEAD 切换/reset/restart 场景触发旧事件再次消费，导致重复派发与状态回写覆盖。
5. 人机判断被误导：前端终端视图历史残留、连接状态提示与真实执行脱节，放大误判。
6. 长运行退化：订阅残留、轮询采样误差与队列无持久化叠加，系统稳定性随时间下降。

### 第四轮新增问题清单（继续深挖）

#### A. 数据一致性与错误传播

1. terminal/task 状态更新非原子，存在“terminal=working 但 task!=running”的中间态分叉。
2. 多处无条件状态更新，失败/完成状态可被后续重试或并发写覆盖。
3. 重复派发同一 terminal 的并发窗口仍在，导致状态反复回写与日志交织。
4. 启动前自愈回退（ready/paused -> created）可能污染正在运行实例的数据面。
5. 无订阅消息丢弃导致“执行事实”与“日志事实”错位。
6. 重启后内存去重失效，旧事件二次落库并污染当前状态。

#### B. 运行时与基础设施

1. 去重与运行态锁以进程内为主，跨实例共享 DB 时无法天然防双驱动。
2. 订阅生命周期依赖惰性清理，长期运行可能累积无效订阅负担。
3. 无订阅即丢弃策略缺乏缓冲/补偿，关键事件可能永久丢失。
4. 队列消息未持久化，重启后事件链可断裂。
5. 快照与订阅存在时间窗，容易出现采样误差与事件漏读。
6. 轮询模型在高频状态变化下会放大性能压力与延迟抖动。

#### C. 前端感知与交互误导

1. 终端切换后历史输出残留，易被误判为新终端仍在持续输出旧上下文。
2. WS 断线后无足够显式提示/自动恢复策略，用户易误判为“执行卡住”。
3. 事件去重不足时，重连或多标签可能出现重复提示与状态抖动。
4. 多标签/多 workflow 下全局连接状态提示可误导当前工作流判断。
5. 活动面板与真实输出流不同步，增加“是否还在运行”的判断噪声。
6. 终端数量/状态计数短时跳变，会放大人工误操作概率。

### 第四轮证据锚点

- 派发与状态推进：`crates/services/src/services/orchestrator/agent.rs:539`
- dispatch 状态更新：`crates/services/src/services/orchestrator/agent.rs:1119`
- terminal 状态更新：`crates/db/src/models/terminal.rs:396`
- workflow_task 状态更新：`crates/db/src/models/workflow.rs:839`
- 多实例去重边界：`crates/services/src/services/orchestrator/runtime.rs:234`
- running 恢复路径：`crates/server/src/routes/workflows.rs:1157`
- GitWatcher 轮询：`crates/services/src/services/git_watcher.rs:234`
- Git hash 比较：`crates/services/src/services/git_watcher.rs:258`
- metadata 解析：`crates/services/src/services/git_watcher.rs:82`
- 消息丢弃路径：`crates/services/src/services/orchestrator/message_bus.rs:153`
- terminal input 回退：`crates/services/src/services/orchestrator/message_bus.rs:259`
- xterm 切换行为：`frontend/src/components/terminal/TerminalEmulator.tsx:132`
- 终端视图切换：`frontend/src/components/terminal/TerminalDebugView.tsx:229`
- 事件处理：`frontend/src/stores/wsStore.ts:909`

### 第四轮结论

1. 第四轮继续确认：该问题是“编排 + 数据 + 事件 + 交互”多层组合故障，不宜按单点问题处理。
2. 目前可确认的风险已从“执行异常”扩展到“数据污染 + 恢复误导 + 长运行退化”。
3. 本节为问题归档追加，不代表修复完成。

## 第四轮对应验证点（超详细执行版）

> 说明：本节为“执行验证清单”，目标是把“组合问题”逐项打穿，不做代码修复，只做可重复验证与证据采集。

### 固定测试参数

- workflow_id：`e44a895b-f4da-412a-9e5d-7320c5593818`
- test repo：`E:\test\test`
- baseline commit：`56393711b855a1e2f9d6ff67cb3c1cea9daeb6c8`
- backend：`http://127.0.0.1:23456`
- frontend：`http://localhost:23457`
- debug 页面：`http://localhost:23457/debug/e44a895b-f4da-412a-9e5d-7320c5593818`

### 统一证据采集规范

1. 每个验证项执行前记录时间戳（精确到秒）。
2. 每个验证项至少保留三类证据：
   - API 快照（workflow/task/terminal 状态）
   - 后端日志片段（关键关键词）
   - 前端页面截图或 WS frame 片段
3. 日志关键词统一检索：
   - `Skipping SendToTerminal`
   - `Dropping message`
   - `Falling back to legacy session topic`
   - `Deferring terminal completion`
   - `already running`
4. 每项验证结束后都要执行回退检查，确保可进入下一项。

### 验证项 V-00：基线完整性

**目标**：确认测试开始前状态完全可比。

**前置条件**：后端服务可访问。

**操作步骤**：
1. 调用 API 获取 workflow 详情：
   - `GET /api/workflows/{workflow_id}`
2. 在 `E:\test\test` 执行：
   - `git rev-parse HEAD`
   - `git status --short`
   - `git branch --format='%(refname:short)'`
3. 检查三层状态：
   - workflow = `created`
   - task = `pending`
   - terminals = `not_started`

**预期结果**：
- workflow/task/terminal 与 baseline 完全一致。
- test repo HEAD 精确等于 baseline commit，且工作区干净，仅 `main` 分支。

**失败判定**：任一状态不一致或 test repo 有脏改动。

**证据采集**：
- API JSON 全量保存一份。
- git 三条命令输出原样保存。

**回退步骤**：
- workflow 数据回退到 `created/pending/not_started`。
- `E:\test\test` 执行 `git reset --hard 56393711...` 与 `git clean -fd`。

### 验证项 V-01：串行不变量（任何时刻最多一个 working）

**目标**：验证“串行执行”核心约束是否被破坏。

**前置条件**：V-00 通过。

**操作步骤**：
1. 启动 workflow。
2. 每 1 秒轮询一次 `GET /api/workflows/{workflow_id}`，持续 5~10 分钟。
3. 每次轮询统计当前 `status == working` 的 terminal 数量。
4. 同时在 debug 页面观察终端卡片状态流转。

**预期结果**：
- 任意时间点 `working` 终端数应始终 `<=1`。

**失败判定**：出现任一时刻 `working` 数量 `>=2`。

**证据采集**：
- 轮询日志（时间戳 + terminal 状态快照）。
- debug 页面同一时刻截图。

**回退步骤**：
- 停止 workflow，回退到 baseline。

### 验证项 V-02：终端完成后是否仍继续输出

**目标**：验证“标记 completed 后仍输出”的核心异常。

**前置条件**：V-01 过程可复现终端交接。

**操作步骤**：
1. 锁定终端1从 `working -> completed` 的时刻（API 轮询记录）。
2. 在该时刻后继续监听终端1伪终端输出 60~120 秒。
3. 对比后端 terminal_log 是否仍写入终端1新日志。

**预期结果**：
- 一旦终端1 completed，不应再有新的终端1执行输出。

**失败判定**：终端1 completed 后仍有持续输出或新日志写入。

**证据采集**：
- 完成时刻前后 2 分钟日志片段。
- 终端1输出截图（含时间）。

**回退步骤**：
- 停止 workflow，清理运行态并回退 baseline。

### 验证项 V-03：注入成功但未发送（状态门槛 + 丢弃）

**目标**：区分“注入成功”与“真正送达终端”的差异。

**前置条件**：日志级别可检索关键字。

**操作步骤**：
1. 在终端交接时段观察输入框出现注入内容。
2. 同步检索后端日志关键词：
   - `Skipping SendToTerminal`
   - `Dropping message`
3. 在 WS frames 中检查是否有对应输入事件到达目标 terminal。

**预期结果**：
- 注入与送达一致，不应出现“注入可见但消息被跳过/丢弃”。

**失败判定**：出现注入可见，同时日志出现 skip/drop 且终端未执行。

**证据采集**：
- 注入界面截图 + 对应日志片段 + WS frame。

**回退步骤**：
- 清理当前运行，恢复 baseline。

### 验证项 V-04：topic fallback 与错投风险

**目标**：确认 terminal.input 主 topic 不可用时 fallback 行为是否安全。

**前置条件**：可观察 message bus 日志。

**操作步骤**：
1. 触发一次交接发送过程。
2. 检索是否出现 `Falling back to legacy session topic`。
3. 若出现，核对最终消息是否进入正确 terminal（终端ID一致）。

**预期结果**：
- fallback 发生时仍应准确送达目标终端。

**失败判定**：fallback 后消息未达或到达错误终端。

**证据采集**：
- fallback 日志 + terminal 输出对照截图。

**回退步骤**：
- 结束当前流程并回退 baseline。

### 验证项 V-05：DB 状态分叉（terminal/task/workflow）

**目标**：验证是否存在数据层状态不一致。

**前置条件**：流程至少运行过一次终端交接。

**操作步骤**：
1. 在关键时刻（终端交接、完成、失败）抓取 workflow 详情 API。
2. 对照 DB 中 terminal 与 task 状态（同时间点）。
3. 重点查找：
   - terminal=working 且 task!=running
   - task=completed 但 workflow 仍 running 且有 active terminal

**预期结果**：
- 三层状态保持一致，不出现分叉。

**失败判定**：任意分叉条件成立。

**证据采集**：
- API JSON + DB 查询结果同屏记录。

**回退步骤**：
- 停止并回退 workflow 状态，清理 test repo。

### 验证项 V-06：重复事件重放（HEAD 切换/reset 场景）

**目标**：验证 GitWatcher 在历史变动场景下是否重放 completion 事件。

**前置条件**：可操作 test repo 的 HEAD。

**操作步骤**：
1. 在 test repo 制造 A->B->A 的 HEAD 切换（或 reset/force 场景）。
2. 观察后端是否将旧提交再次识别为新事件。
3. 检查是否触发重复 completion/重复派发。

**预期结果**：
- 旧事件不应导致新的派发动作。

**失败判定**：出现重复 completion 或重复推进。

**证据采集**：
- 提交哈希时间序列 + watcher 日志 + workflow 状态变化。

**回退步骤**：
- test repo 回 baseline commit；workflow 回 baseline 状态。

### 验证项 V-07：多实例/并发启动冲突

**目标**：验证 runtime 去重是否仅进程内，跨实例是否可双驱动。

**前置条件**：可并行运行两个后端实例（同一 DB）。

**操作步骤**：
1. 实例A、实例B同时启动并指向同一数据库。
2. 并发调用同一 workflow 的 start。
3. 观察是否出现双 `orchestrator started` 或双 watcher 活动。

**预期结果**：
- 应有全局互斥，最多一个实例驱动该 workflow。

**失败判定**：出现双驱动迹象或状态来回回退。

**证据采集**：
- A/B 两端日志 + workflow 状态时间线。

**回退步骤**：
- 关闭其中一实例，清理运行态并回 baseline。

### 验证项 V-08：前端切换终端“串台错觉”

**目标**：验证 xterm 历史残留是否导致误判。

**前置条件**：两个终端输出可区分（不同标记词）。

**操作步骤**：
1. 终端1输出标记 `T1_ONLY`，终端2保持静默。
2. 从终端1切换到终端2，不点击 Clear。
3. 观察终端2画面是否保留 `T1_ONLY` 历史。
4. 点击 Clear 后再次观察。

**预期结果**：
- 切换后应明确区分当前终端输出；Clear 可清除残留错觉。

**失败判定**：终端切换后保留旧历史且易被误认为当前输出。

**证据采集**：
- 切换前/后/清屏后对比截图。

**回退步骤**：
- 恢复默认显示，不影响后端状态。

### 验证项 V-09：WS 断线恢复与误导性状态

**目标**：验证网络波动时前端是否给出足够可操作反馈。

**前置条件**：浏览器可模拟 Offline。

**操作步骤**：
1. 运行中将浏览器切为 Offline 10~20 秒。
2. 观察终端输出是否停止、状态栏是否提示断线。
3. 恢复网络后观察是否自动恢复或需人工刷新。

**预期结果**：
- 断线应有明确反馈；恢复后应可重新获取状态，不应静默失败。

**失败判定**：断线无提示、恢复后无数据更新但 UI 仍显示正常连接。

**证据采集**：
- Offline/Online 时刻截图 + WS 状态日志。

**回退步骤**：
- 恢复网络并重新打开 debug 页面。

### 验证项 V-10：长时间运行退化（稳定性）

**目标**：验证长运行是否出现延迟增大、丢事件、状态抖动变频。

**前置条件**：可持续运行 30~60 分钟。

**操作步骤**：
1. 启动 workflow 并保持观察窗口开启。
2. 每 5 分钟记录一次：
   - API 响应时间
   - 终端状态更新延迟
   - 丢消息关键词出现次数
3. 比较 0 分钟与 60 分钟指标差异。

**预期结果**：
- 指标应稳定，无显著退化。

**失败判定**：
- 响应时间持续恶化；
- 状态更新延迟明显拉长；
- 丢消息日志显著增多。

**证据采集**：
- 时间序列表格（5分钟粒度）+ 日志统计。

**回退步骤**：
- 停止运行并回 baseline。

### 执行结束统一回退检查

每轮验证结束后必须再次确认：

1. workflow：`created / pending / not_started`
2. test repo HEAD：`56393711b855a1e2f9d6ff67cb3c1cea9daeb6c8`
3. test repo 工作区干净（无未追踪/未提交）
4. 仅保留必要服务进程（避免并发测试污染下一轮）

若任一不满足，必须先回退再进入下一项验证。
