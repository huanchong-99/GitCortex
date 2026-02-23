# Phase 26：联合审计问题全量修复计划（Codex + Claude）

> 创建日期：2026-02-08  
> 状态：📋 待实施  
> 优先级：🔴 最高  
> 对应 TODO：`docs/undeveloped/current/TODO.md` Phase 26  
> 审计来源：`docs/developed/plans/codex和Claudecode联合分析_三文件增量合并.md`

---

## 1. 范围与目标

- 问题总数：60
- 阻断级（A）：19
- 逻辑级（B）：21
- 兼容/实现级（C）：10
- 合并报告补充高优先（S）：10
- 目标：完成 60/60 问题修复闭环，确保主链路“创建→准备→启动→终端/WS→尝试执行→合并”稳定可用

---

## 2. Sub-agent 执行模型

- 执行模式：`60 个问题 = 60 个问题 Agent`，另设 `1 个跨模块联动 Agent`
- 合计 Agent 数：61
- 角色建议：
  - 前端问题：前端/全栈 Agent
  - 后端问题：后端/全栈 Agent
  - 跨端契约与链路问题：全栈 Agent
- 统一要求：每个问题 Agent 需输出
  - 受影响模块
  - 复现条件
  - 修复点
  - 回归点

---

## 3. 里程碑与并行策略

### M1（P0 阻断级收敛，26.1-26.19）

- 目标：先解除阻断，保证系统可运行、可观测、可回退
- 通过标准：P0 全部关闭；核心创建/启动/停止/合并链路不再出现“假成功”与“无输出运行”

### M2（P1 逻辑级修复，26.20-26.40）

- 目标：修复事件、订阅、缓存、状态机、路径与资源清理逻辑问题
- 通过标准：并发订阅稳定、事件不丢、状态一致、资源回收正确

### M3（P2 兼容级修复，26.41-26.50）

- 目标：修复类型、跨平台、序列化与边界条件问题
- 通过标准：Windows/Linux 一致性通过，前后端类型检查通过

### M4（跨模块联动审计）

- 目标：执行“全链路 + 异常链路 + 回归”联合验证
- 通过标准：关键链路端到端验证通过，且无回归破坏 Phase 24/25 成果

---

## 4. 任务分解（与 TODO 26.1-26.60 一一对应）

## P0 - 阻断级（A1-A19）

| Task | 问题摘要 | 建议 Agent | 验收要点 |
|------|----------|------------|----------|
| 26.1 | Step4 终端校验键不一致导致无提示阻断 | Agent-26.1（FE） | 校验错误可见且可定位；阻断逻辑一致 |
| 26.2 | 多任务 Workflow 终端初始化缺失导致提交失败 | Agent-26.2（BE） | 多任务提交成功；每任务终端均初始化 |
| 26.3 | DiffsPanel 渲染期 setState 引发抖动/循环风险 | Agent-26.3（FE） | 无 render 期 setState；页面无抖动 |
| 26.4 | stop_workflow 未停止终端进程 | Agent-26.4（BE） | 停止后进程退出；无僵尸进程 |
| 26.5 | merge 仅改状态未真实合并 | Agent-26.5（BE） | 执行真实合并动作；失败可见 |
| 26.6 | 终端状态枚举前后端不一致 | Agent-26.6（FS） | 前后端状态全集一致；无崩溃 |
| 26.7 | Review 事件语义误发到 workflow.status_changed | Agent-26.7（BE） | 事件类型语义正确；前端消费正常 |
| 26.8 | WorkflowTask 未正确绑定 vk_task_id | Agent-26.8（BE） | 任务-终端-执行链路可追踪 |
| 26.9 | task attempt 启动失败被吞 | Agent-26.9（BE） | 启动失败对调用方显式返回 |
| 26.10 | 无 process 时 Follow-up 被禁用 | Agent-26.10（FE） | 失败态仍可输入 Follow-up 自救 |
| 26.11 | createTask 后错误跳 attempts/latest | Agent-26.11（FE） | 创建后跳转逻辑与 attempt 实际一致 |
| 26.12 | Slash Command description 前后端校验不一致 | Agent-26.12（FS） | 同一规则在前后端一致 |
| 26.13 | Slash Command 重命名命令名无效 | Agent-26.13（BE） | 重命名生效且唯一性校验正确 |
| 26.14 | Open Editor 请求字段契约不一致 | Agent-26.14（FS） | `file_path/git_repo_path` 契约统一 |
| 26.15 | attempt-context 不支持子目录 ref 解析 | Agent-26.15（BE） | 子目录 ref 可解析且返回正确上下文 |
| 26.16 | 容器 not found 映射为 500 | Agent-26.16（BE） | not found 返回 404 |
| 26.17 | Terminal WS 超时误断只读会话 | Agent-26.17（BE） | 只读会话保持；超时策略合理 |
| 26.18 | stop terminal 对不存在 id 假成功 | Agent-26.18（BE） | 不存在返回 not_found |
| 26.19 | 任务列表 executor 可空解码异常 | Agent-26.19（BE） | 可空字段稳定解码；无 500 |

## P1 - 逻辑级（B1-B21）

| Task | 问题摘要 | 建议 Agent | 验收要点 |
|------|----------|------------|----------|
| 26.20 | useWorkflowEvents 无引用计数导致多订阅互断 | Agent-26.20（FE） | 多订阅并存稳定；卸载不互相断开 |
| 26.21 | WS Store 单连接导致多 workflow 串线 | Agent-26.21（FE） | 支持多 workflow 并行订阅 |
| 26.22 | 缺失 terminal.prompt_* 事件前端类型与消费 | Agent-26.22（FE） | 事件类型与消费链路补齐 |
| 26.23 | EventBridge 无订阅场景直接丢事件 | Agent-26.23（FS） | 无订阅时可补偿或缓存 |
| 26.24 | lagged 事件静默丢弃 | Agent-26.24（BE） | lagged 可恢复并有日志 |
| 26.25 | prepare 部分失败未回滚已启动终端 | Agent-26.25（BE） | 失败可完整回滚 |
| 26.26 | workflow task 状态接口接受非法 in_progress | Agent-26.26（BE） | 非法状态被拒绝 |
| 26.27 | 单仓 open-editor + file_path 基目录拼接错误 | Agent-26.27（BE） | 路径拼接正确且可打开目标文件 |
| 26.28 | 多仓 merge 提前 Done/归档 workspace | Agent-26.28（BE） | 仅在真实完成后置 Done |
| 26.29 | 删除任务缓存 key 错误导致详情闪回 | Agent-26.29（FE） | 删除后详情缓存一致、无回闪 |
| 26.30 | useAttemptExecution 空 key 停止态串扰 | Agent-26.30（FE） | key 隔离；不同任务互不影响 |
| 26.31 | Follow-up 脚本入口与 Result 错误处理不一致 | Agent-26.31（BE） | 入口可用性与错误处理一致 |
| 26.32 | ExecutionProcessesProvider 未纳入 attemptId | Agent-26.32（FE） | attempt 维度隔离正确 |
| 26.33 | subscription_hub 无订阅也建 channel | Agent-26.33（BE） | 无订阅不建 channel；资源稳定 |
| 26.34 | workspace 清理 SQL 未正确处理 NULL completed_at | Agent-26.34（BE） | 僵尸 workspace 可回收 |
| 26.35 | execution_process 完成更新不刷新 updated_at | Agent-26.35（BE） | 完成态同步更新时间 |
| 26.36 | raw logs WS 重复拉流 | Agent-26.36（BE） | 每链路仅一次拉流 |
| 26.37 | Project Open Editor 缺少项目内路径约束 | Agent-26.37（BE） | 仅允许白名单/项目内路径 |
| 26.38 | 远程编辑器 URL 未编码特殊字符 | Agent-26.38（FE） | 特殊字符路径可正确打开 |
| 26.39 | 远程 :1:1 追加依赖本地 is_file 语义 | Agent-26.39（FS） | 远程语义下定位规则正确 |
| 26.40 | 组织/远程项目入口与后端能力不一致 | Agent-26.40（FS） | 前后端能力对齐（支持或禁用） |

## P2 - 兼容/实现级（C1-C10）

| Task | 问题摘要 | 建议 Agent | 验收要点 |
|------|----------|------------|----------|
| 26.41 | ProjectSettings 更新类型不完整导致前端检查失败 | Agent-26.41（FE） | `pnpm -C frontend run check` 通过 |
| 26.42 | executors command build 空 base 可能 panic | Agent-26.42（BE） | 空 base 走保护逻辑，无 panic |
| 26.43 | plain_text_processor time_gap 分支丢 chunk | Agent-26.43（BE） | time_gap 分支不丢数据 |
| 26.44 | review session selector 双 Skip 索引偏移 | Agent-26.44（FE） | 选择索引准确 |
| 26.45 | review 的 gh 检测不兼容 Windows | Agent-26.45（BE） | Windows 使用 `where` 检测通过 |
| 26.46 | cc-switch 原子写入不兼容 Windows 已存在目标 | Agent-26.46（BE） | Windows 目标已存在时写入成功 |
| 26.47 | MCP 不支持错误文案/错误码不统一 | Agent-26.47（FS） | 前端可稳定识别错误类型 |
| 26.48 | MCP 保存逻辑依赖对象引用找 profile key | Agent-26.48（FE） | 使用稳定 key，重载后不丢配置 |
| 26.49 | Workflow 状态枚举缺失 merging | Agent-26.49（FE） | 前端状态枚举与后端对齐 |
| 26.50 | TerminalDto.customApiKey 序列化与 shared 类型不一致 | Agent-26.50（FS） | 序列化与类型定义一致 |

## P0/P1 - 合并报告补充高优先（S1-S10）

| Task | 问题摘要 | 建议 Agent | 验收要点 |
|------|----------|------------|----------|
| 26.51 | `Terminal::set_started()` 状态语义错误（waiting/started） | Agent-26.51（BE） | 状态命名与实际行为一致，状态机可读 |
| 26.52 | 终端状态变化缺失 WebSocket 事件 | Agent-26.52（FS） | 状态变化可实时广播并被前端消费 |
| 26.53 | prepare 流程状态转换混乱导致卡 waiting | Agent-26.53（BE） | prepare 后状态可正确推进，不卡死 |
| 26.54 | auto_confirm 未驱动 PromptWatcher 注册 | Agent-26.54（BE） | auto_confirm 开关对注册路径生效 |
| 26.55 | PromptHandler 决策逻辑与 auto_confirm 脱节 | Agent-26.55（BE） | 决策与配置一致，行为可预测 |
| 26.56 | 历史 auto_confirm 数据未迁移 | Agent-26.56（DB） | 迁移后历史数据具备正确缺省值 |
| 26.57 | Phase 24/25 自动确认集成断点 | Agent-26.57（FS） | 事件→识别→决策→执行链路打通 |
| 26.58 | 手动启动路径 logger 失败处理不一致 | Agent-26.58（BE） | 手动/自动启动失败语义统一 |
| 26.59 | TerminalLogger flush 恢复机制竞态 | Agent-26.59（BE） | 恢复流程幂等，无重复恢复与丢失 |
| 26.60 | broadcast lagged 输出补偿链路缺失 | Agent-26.60（FS） | lagged 可补偿且具备观测与告警 |

---

## 5. 跨模块联动 Agent（Agent-X）

- 负责范围：`26.1-26.60` 的跨模块组合验收
- 关键链路：
  - Workflow 创建
  - prepare/终端初始化
  - terminal 启动与 WS 事件
  - attempt 执行与 Follow-up
  - merge 与 workspace 回收
- 联动验收：
  - 不允许“状态成功但功能未执行”
  - 不允许“流程运行但事件丢失/无输出”
  - 不允许“单模块修复破坏已完成 Phase 24/25”

---

## 6. 验证矩阵

### 前端

- 多 workflow 并行订阅、事件隔离、状态展示一致
- prompt 事件可见且行为正确
- 删除任务、跳转、attempt 维度缓存行为稳定

### 后端

- 启停/prepare/merge/清理路径错误码语义正确
- 日志与流式处理不丢、不重、不泄漏
- 状态机输入输出合法且可追踪

### WebSocket

- 状态事件、日志事件、prompt 事件全覆盖
- 断连重连可恢复
- lagged 场景可补偿或可观测

### 跨平台

- Windows/Linux 路径、命令检测、原子写入行为一致

### 回归

- 前端检查：`pnpm -C frontend run check`
- 后端测试：核心单测 + 集成回归
- 链路回归：创建→准备→启动→终端→attempt→merge

---

## 7. 交付标准

- `TODO.md` 的 Phase 26 全部任务状态由 `⬜` 更新为 `✅`
- 审计报告中的 60 个高优先问题均可追溯到修复提交与验证记录
- 不新增新的阻断级问题
- 产出 Phase 26 完成报告（包含变更列表与回归结果）
