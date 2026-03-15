# Phase 1 — 前端核心修复（Agent 9-15，完全并行）

> 前置条件：Phase 0 全部完成并通过集成检查。
> 预计产出：前端核心交互（Workflow 页面、WebSocket、Wizard、Debug 页面）修复完成。
> Phase 内 7 个 Agent 完全并行，无文件交叉。
> **每个 Agent 只要涉及文件索引，100% 必须使用 augment-code MCP。**

---

## Agent 9 — Workflows.tsx 页面（Prompt 队列 + 操作互斥 + 事件订阅）

**负责文件（独占）：**
- `frontend/src/pages/Workflows.tsx`

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G07-004 | P3 | Prompt dedup 窗口（前端 1.5s）与后端 debounce（500ms）不对齐，合法 prompt 可能被丢弃 | 将 submitted history TTL 从 1.5s 降低到 600ms，与后端 debounce 对齐 |
| G07-007 | P3 | `isSamePromptContext` 在 sessionId 缺失时仅比较 workflowId+terminalId，多 prompt 场景误匹配 | 添加 `promptKind` 字段作为补充匹配维度 |
| G07-011 | P3 | promptQueue 仅展示第一条，并发多终端 prompt 不可见 | 添加 queue count 指示器（如 "1/3"）在 prompt dialog 标题栏 |
| G08-003 | P3 | 未订阅 `onGitCommitDetected` 事件，git commit 不触发本页面刷新 | 添加 `onGitCommitDetected` handler，调用 `invalidateQueries` 刷新 workflow 数据 |
| G26-004 | P2 | 快速连续点击不同操作按钮缺乏全局互斥 | 添加 `isAnyMutationPending` 计算属性，pending 时 disable 所有操作按钮 |
| G26-007 | P2 | Merge 进度无实时展示，用户只看到 "Merging..." 文字 | 订阅 task merge 进度事件，显示 "Merging (2/5 tasks)" 进度文本 |
| G26-008 | P2 | WS 断开时操作按钮仍可点击，后续状态无法通过 WS 更新 | 读取 wsStore connection status，断开时显示 warning banner + disable 写操作按钮 |
| G26-009 | P3 | Stop 成功后前端不清空 promptQueue，prompt dialog 残留 | `useStopWorkflow` 的 `onSuccess` 中清空 `promptQueue` 状态 |
| G27-003 | P2 | promptQueue dedup ID 基于内容 hash，1.5s 内连续相同 prompt 被错误去重 | dedup ID 中加入 timestamp 或后端 event ID |
| G27-004 | P3 | `sendPromptResponse` 失败无重试且无用户可见反馈 | 添加 retry 按钮 + toast 错误通知 |
| G27-005 | P3 | promptQueue 无超时清理，长时间未响应的 prompt 永久阻塞 UI | 添加 120s 超时自动清理 + 超时 toast 提示 |
| G27-006 | P3 | WS fallback 路径发送空字符串 `enter_confirm` 响应，语义不明确 | 添加注释说明 fallback 语义，并在 UI 侧显示 "(auto-confirmed)" 标记 |
| G27-008 | P3 | 同 G07-011，promptQueue 只显示第一条 | 与 G07-011 合并修复 |
| G28-004 | P1 | OrchestratorChatPanel 使用 2s 轮询获取消息，与 WS 架构冲突 | 改为订阅 WS 事件（`orchestrator.message` 类型），移除 setInterval 轮询 |

**注意事项：**
- Workflows.tsx 是前端最大页面文件（1200+ 行），修改需格外小心保持现有逻辑完整
- G26-008 需要读取 wsStore 的 connection status，但不修改 wsStore.ts（Agent 11 负责 wsStore）
- G27-008 与 G07-011 是同一个问题的不同视角，合并为一次修复
- G28-004 是 P1 最高优先级，应最先处理
- prompt 相关修改（G07/G27）之间有逻辑关联，建议按顺序修复：G28-004 → G27-003 → G07-004 → G07-007 → G07-011/G27-008 → G27-005 → G26-004
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 10 — useWorkflows.ts + React Query 全局配置

**负责文件（独占）：**
- `frontend/src/hooks/useWorkflows.ts`
- `frontend/src/main.tsx`（仅 QueryClient defaultOptions 配置）

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G02-004 | P3 | `usePrepareWorkflow` 的 `onError` 缺少 cache invalidation，UI 在 prepare 失败后状态滞后 | `onError` 中调用 `queryClient.invalidateQueries({ queryKey: workflowKeys.forProject(projectId) })` |
| G02-007 | P3 | 前端 `WorkflowStatusEnum` 包含 'draft' 但后端枚举无此值 | 移除前端 'draft' 枚举值，或重命名为 'created'（与后端对齐） |
| G05-009 | P3 | `useStopWorkflow` / `usePauseWorkflow` 缺少 optimistic updates，UI 状态延迟 | 添加 `onMutate` optimistic update：立即设置 status 为目标状态 |
| G26-003 | P2 | 所有 mutation hooks 缺少 optimistic updates，WS 推送到达前 UI 有空窗期 | 为 9 个 mutation hook 统一添加 `onMutate` → `onError`（回滚）→ `onSettled`（invalidate）模式 |
| G26-005 | P2 | Prepare 失败不触发 cache invalidation，UI 卡在 "starting" 状态 | `usePrepareWorkflow` 的 `onError` 中 invalidate workflow 查询 |
| G26-006 | P2 | 所有 mutation `onError` 不 invalidate cache，失败后 UI 显示陈旧状态 | 统一 `onError` 模式：invalidate 相关 queries + toast 错误通知 |
| G26-012 | P3 | `usePrepareWorkflow` 的 `onSuccess` invalidate `workflowKeys.all`（范围过大） | 精确 invalidate `workflowKeys.forProject(projectId)` |
| G30-004 | P2 | 9 个 mutation hooks 的 `onError` 仅 `console.error`，无用户可见通知 | 统一添加 toast notification |
| G30-005 | P2 | 全局 QueryClient 缺少 mutations 默认 retry / onError 配置 | `main.tsx` 中 `defaultOptions.mutations` 添加 `retry: false` + 全局 `onError` toast |
| G30-006 | P2 | React Query 默认 retry 3 次对 4xx 错误不合理 | 自定义 retry 函数：仅对 5xx / 网络错误重试，4xx 不重试 |

**注意事项：**
- useWorkflows.ts 包含 9 个 mutation hooks，统一添加 optimistic update 模式是本 Agent 核心工作
- 推荐实现：创建 `createOptimisticMutation` 工具函数封装 onMutate/onError/onSettled 三件套
- main.tsx 修改仅限 QueryClient defaultOptions，不改其他初始化逻辑
- G02-007 修改前端枚举后需确认无其他地方引用 'draft'（使用 augment-code MCP 搜索）
- G26-003 和 G26-006 是同一批 mutations 的不同方面，应一起实现
- **修改后运行 `cd frontend && pnpm test:run` 验证**
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 11 — wsStore.ts WebSocket 状态管理

**负责文件（独占）：**
- `frontend/src/stores/wsStore.ts`

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G08-006 | P3 | 收到 `system.lagged` 后无动作，不触发全量刷新 | 检测 `lagged` 事件后调用 `queryClient.invalidateQueries()` 全量刷新 |
| G08-007 | P2 | `useWorkflowEvents` handlers 有不稳定依赖，导致频繁重新订阅 | 内部使用 `useRef` 缓存 handlers，subscription 仅在 mount/unmount 时变化 |
| G12-001 | P2 | `_handlers` / `_workflowHandlers` 直接 Map 操作绕过 Zustand `set()` | 添加设计决策注释说明为何绕过 `set()`（性能考虑：避免每次 handler 注册触发全组件 re-render） |
| G12-003 | P1 | `disconnect()` 不清空全局 `_handlers`，旧 handlers 在重连后继续触发 | disconnect 时 `_handlers.clear()` + `_workflowHandlers.clear()` |
| G12-009 | P1 | `useWorkflowEvents` 在 handlers 变化时的 unsubscribe/subscribe 间隙存在事件丢失窗口 | 使用 `useRef` 持有 handlers 引用，避免重新订阅；event 分发时读取 ref.current |
| G27-001 | P2 | `normalizeTerminalPromptDetectedPayload` 不提取后端推送的 `autoConfirm` 字段 | 解析 payload 时提取 `autoConfirm` 布尔字段，透传给 prompt handler |
| G30-007 | P2 | WebSocket `onerror` 仅 `console.error`，无用户可见通知 | 更新 store 中的 connection status 为 `error`，触发 UI 显示错误状态 |
| G30-008 | P2 | WebSocket 重连超过 max retries 后静默放弃，用户无感知 | 超限后将 status 设为 `failed`，暴露 `lastError` 字段，触发 `system.connection_failed` 事件 |
| G31-002 | P2 | 前端 `QualityGateResultPayload` 缺少 `commitHash` 字段 | 在 wsStore 的类型定义中添加 `commitHash` 字段（需 Phase 0 Agent 2 先完成后端 workflow_events.rs 修改） |

**注意事项：**
- wsStore.ts 是前端最复杂的状态管理文件（1600+ 行），修改需极度小心
- G12-003 和 G12-009 是 P1 最高优先级，应最先处理
- G12-003 的 `disconnect()` 清空 handlers 需要考虑 "有意断开" vs "意外断开" 场景
  - 有意断开（用户离开页面）：清空 handlers ✓
  - 意外断开（网络问题）：保留 handlers，重连后自动恢复 ✓
  - 实现：`disconnect(intentional: boolean)` 参数区分
- G08-007 和 G12-009 都涉及 `useRef` 缓存 handlers，可合并实现
- G31-002 依赖 Phase 0 Agent 2 的后端修改，如后端未完成可先添加可选字段 `commitHash?: string`
- **修改后运行 `cd frontend && pnpm test:run` 验证**
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 12 — Debug 页面（WorkflowDebugPage + TerminalDebugView + TerminalEmulator）

**负责文件（独占）：**
- `frontend/src/pages/WorkflowDebugPage.tsx`
- `frontend/src/components/workflow/TerminalDebugView.tsx`
- `frontend/src/components/workflow/TerminalEmulator.tsx`

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G28-001 | P1 | `mapTerminalStatus` 将 `cancelled` 映射为 `not_started`，丢失语义 | 直接返回 `cancelled`，在 UI 中添加 cancelled 状态展示 |
| G28-003 | P1 | WorkflowDebugPage 使用 1.5s 轮询获取 workflow 数据，未使用 WebSocket | 引入 `useWorkflowEvents` 替代轮询，通过 WS 事件触发 `invalidateQueries` |
| G28-008 | P3 | `mapTerminalStatus` 缺少 `review_passed` / `review_rejected` 映射，fallback 到 `not_started` | 添加 `review_passed` → `review_passed` 和 `review_rejected` → `review_rejected` 映射 |
| G09-002 | P3 | `shouldRenderLiveTerminal` 检查 `running` / `active` 属于死代码分支 | 移除 `running` / `active` 分支，简化为仅检查 `working` |
| G09-012 | P1 | 历史 terminal log 加载 API 无分页，一次加载 1000 条 | 实现虚拟滚动（react-virtuoso）或分页加载（offset + limit） |
| G28-002 | P2 | `shouldRenderLiveTerminal` 包含 `running` / `active` 死代码 | 同 G09-002，合并修复 |
| G28-005 | P1 | 切换终端时存在竞态条件，可能泄漏旧 WS 连接 | 切换前显式断开旧连接（`ws.close()`），使用 `useEffect` cleanup 函数确保清理 |
| G28-006 | P2 | 大量 `useRef` 绕过 React render cycle 管理状态，UI 可能不同步 | 将关键状态（isConnected, currentTerminalId）改为 `useState`，保留性能敏感的 ref |
| G28-007 | P2 | 历史 terminal logs 拼接为单个 `pre` 元素，大日志性能问题 | 实现虚拟滚动或分段渲染（与 G09-012 配合） |
| G28-009 | P3 | `allTerminals` useEffect 依赖对象数组，每次渲染都触发 | 使用 `useMemo` 缓存 `allTerminals` 列表，以 terminal IDs 字符串作为依赖 |
| G28-011 | P3 | 初始化 useEffect 依赖不稳定的 `handleData` / `handleResize` 引用 | 将初始化和事件绑定分离为两个 useEffect |
| G09-009 | P3 | `pendingInputRef` 无大小限制，极端场景内存增长 | 添加队列大小上限（1000 条），超限时丢弃最旧的 |

**注意事项：**
- 本 Agent 管理 3 个紧密关联的文件，它们共同构成 Debug 页面
- G28-005 涉及 TerminalDebugView 和 TerminalEmulator 两个文件的协调：
  - TerminalDebugView 负责 terminal 切换逻辑
  - TerminalEmulator 负责 WS 连接生命周期
  - 切换时 TerminalDebugView 先触发 cleanup，TerminalEmulator 响应 unmount
- G09-012 和 G28-007 是同一问题（大日志性能），统一用虚拟滚动解决
- G28-001 和 G28-008 都修改 `mapTerminalStatus`，应一次性完成
- 建议修复顺序：G28-001/008 → G28-003 → G28-005 → G09-012/G28-007 → 其余
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 13 — Wizard 验证器 + 类型定义

**负责文件（独占）：**
- `frontend/src/components/workflow/wizard/validators/step0Project.ts`
- `frontend/src/components/workflow/wizard/validators/step2Tasks.ts`
- `frontend/src/components/workflow/wizard/validators/step3Models.ts`
- `frontend/src/components/workflow/wizard/validators/step5Commands.ts`
- `frontend/src/components/workflow/wizard/types.ts`
- `frontend/src/components/workflow/wizard/WorkflowWizard.tsx`（仅 handleNext 和 mode 切换逻辑）

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G25-003 | P2 | Step0 验证器不检查 `gitStatus.isGitRepo`，非 Git 目录通过验证 | 添加 `isGitRepo` 检查，false 时返回错误 "Selected directory is not a Git repository" |
| G25-004 | P2 | Step2 验证器不检查 branch 字段，空分支名通过验证 | 添加 branch 非空检查 + git branch 命名规则验证（无空格、特殊字符） |
| G25-005 | P2 | Step2 验证器不检查重复分支名 | 遍历 tasks 数组检测 branch 唯一性，重复时返回具体错误 "Branch name '{name}' is used by multiple tasks" |
| G25-006 | P2 | Step3 验证器不检查 `apiKey` / `baseUrl` / `modelId` 必填字段 | 添加必填字段非空验证，区分不同 CLI 类型的必填项 |
| G25-009 | P2 | Step5Commands 验证器为空，启用命令但未选择 preset 不报错 | 添加 "commands enabled but no preset selected" 检查 |
| G25-007 | P2 | `errorTerminal` 的 `customBaseUrl` / `customApiKey` 硬编码为 null | 从 orchestrator model config 中提取实际值 |
| G25-008 | P2 | `mergeTerminal` 同样 `customBaseUrl` / `customApiKey` 硬编码为 null | 同 G25-007，从 model config 提取 |
| G25-016 | P2 | `wizardConfigToCreateRequest` 在 `orchestratorModel` 查找失败时抛裸 JS Error | Step6 验证器中添加 orchestratorModel 存在性检查，提前拦截 |
| G25-010 | P3 | Step3 model ID 使用 `Date.now()`，快速连续添加可能重复 | 改用 `crypto.randomUUID()` |
| G25-018 | P3 | `handleNext` 中 `clearErrors` 在 `navigation.next()` 之后调用，导致 UI 闪烁 | 交换顺序：先 `clearErrors()` 再 `navigation.next()` |

**注意事项：**
- 验证器文件都很小（<50行），修改量不大但需要理解 wizard 数据流
- types.ts 中 `errorTerminal` / `mergeTerminal` 的修改需理解 model config 结构
- G25-016 需要检查 Step6 验证器是否存在，不存在则在 `wizardConfigToCreateRequest` 函数开头添加 guard
- WorkflowWizard.tsx 的修改仅限 `handleNext` 函数内的两行顺序交换
- 验证器修改后需手动测试 wizard 流程（通过 Chrome DevTools MCP）
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 14 — api.ts + Context 组件 + Board 质量门禁

**负责文件（独占）：**
- `frontend/src/lib/api.ts`（仅 imagesApi / oauthApi / handleApiResponse 部分）
- `frontend/src/contexts/TabNavigationContext.tsx`
- `frontend/src/contexts/SearchContext.tsx`
- `frontend/src/components/board/Board.tsx`（仅 quality gate handler）

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G30-009 | P2 | `imagesApi` upload 错误处理与 `handleApiResponse` 标准不一致 | 统一使用 `handleApiResponse` 处理 imagesApi 的响应 |
| G30-010 | P2 | `oauthApi.logout` / `getToken` 绕过 `handleApiResponse` 标准错误处理 | 统一使用 `handleApiResponse` |
| G30-011 | P3 | `handleApiResponse` 对 `response.json()` 解析失败无 try-catch | 添加 `SyntaxError` catch，返回友好错误消息 "Invalid JSON response from server" |
| G36-009 | P2 | `TabNavigationContext.tsx` 仅导出 `createContext` 裸对象，无 Provider 和 null guard | 添加 `TabNavigationProvider` 组件和 `useTabNavigation` hook（含 null guard throw） |
| G36-010 | P2 | `SearchContext.tsx` 的 `useMemo` 依赖数组缺少 `clear` 函数引用 | 用 `useCallback` 包裹 `clear`，并加入 `useMemo` 依赖数组 |
| G31-007 | P3 | `handleQualityGateResult` 不 invalidate `runDetail` / `issuesForRun` 查询 | 添加 `queryClient.invalidateQueries({ queryKey: ['qualityRun', ...] })` |

**注意事项：**
- api.ts 修改范围明确：仅 imagesApi（L1105-L1175）、oauthApi（L1234-L1251）、handleApiResponse 三个区域
- TabNavigationContext 目前可能未被使用，先确认引用点（使用 augment-code MCP 搜索 "TabNavigationContext"）
- Board.tsx 修改仅限 quality gate result handler 函数内添加一行 invalidateQueries
- SearchContext 的 `useCallback` 包裹需确认 `clear` 函数的当前实现
- **必须使用 augment-code MCP 进行文件索引**

---

## Agent 15 — Icon 迁移 + i18n + 前端杂项

**负责文件（独占）：**
- `frontend/src/components/workflow/DisplayConversationEntry.tsx`
- `frontend/src/components/workflow/wizard/steps/Step0Project.tsx`（仅 icon import）
- `frontend/src/components/workflow/wizard/steps/Step2Tasks.tsx`（仅 icon import）
- `frontend/src/components/workflow/wizard/steps/Step3Models.tsx`（仅 G25-010 已由 Agent 13 处理，本 Agent 不触碰）
- `frontend/src/components/workflow/wizard/steps/Step4Terminals.tsx`（仅 icon import）
- `frontend/src/components/workflow/wizard/steps/Step5Commands.tsx`（仅 icon import）
- `frontend/src/i18n/config.ts`
- `frontend/src/i18n/locales/ja/`（新增文件）
- `frontend/src/i18n/locales/es/`（新增文件）
- `frontend/src/i18n/locales/ko/`（新增文件）
- `frontend/src/i18n/locales/zh-Hant/`（新增文件）

**修复清单：**

| ID | 严重度 | 问题 | 修复方案 |
|----|--------|------|----------|
| G09-011 | P2 | `DisplayConversationEntry.tsx` 使用 `lucide-react` 图标，违反项目 ESLint 约定 | 将所有 lucide-react icon import 替换为 `@phosphor-icons/react` 等效图标 |
| G25-013 | P3 | `Step5Commands.tsx` 使用 `lucide-react` 图标 | 替换为 `@phosphor-icons/react` |
| G25-014 | P3 | `Step0Project.tsx` / `Step2Tasks.tsx` / `Step4Terminals.tsx` 也使用 `lucide-react` | 统一迁移为 `@phosphor-icons/react` |
| G36-001 | P1 | i18n `workflow` namespace 在 ja/es/ko/zh-Hant 4 个语言中缺失 | 为 4 个语言创建 `workflow.json` 文件并在 config.ts 中注册 |
| G36-002 | P1 | i18n `quality` namespace 在 ja/es/ko/zh-Hant 4 个语言中缺失 | 为 4 个语言创建 `quality.json` 文件并在 config.ts 中注册 |
| G36-012 | P2 | i18n fallback 默认到 zh-Hans，非中文用户看到中文 missing keys | 修改 fallback chain 为 `['en', 'zh-Hans']`，英文优先 |

**注意事项：**
- Icon 迁移需保持视觉一致性，lucide 到 phosphor 的常见映射：
  - `ChevronDown` → `CaretDown`
  - `Plus` → `Plus`
  - `Trash2` → `Trash`
  - `Settings` → `GearSix`
  - `Terminal` → `Terminal`
  - `GitBranch` → `GitBranch`
  - 使用 augment-code MCP 搜索所有 lucide-react import 确保无遗漏
- Wizard steps 文件的 icon import 修改不影响 Agent 13 的验证器逻辑修改（Agent 13 不修改 Step*.tsx 的 icon 行）
- i18n 新增 JSON 文件：可从 en 或 zh-Hans 复制结构，value 暂时保留英文（后续翻译）
- i18n config.ts 修改需确认 namespace 注册格式
- **修改后运行 `pnpm run frontend:lint:i18n` 验证**
- **必须使用 augment-code MCP 进行文件索引**

---

## Phase 1 完成后的集成检查

Phase 1 所有 7 个 Agent 完成后，在进入 Phase 2 前需执行：

1. `cd frontend && pnpm test:run` — 全量前端测试
2. `cd frontend && pnpm run lint` — ESLint 无新错误
3. `cd frontend && pnpm run lint:strict` — 严格模式检查
4. `cd frontend && pnpm run lint:i18n` — i18n 检查
5. `pnpm run frontend:check` — TypeScript 编译通过
6. `pnpm run generate-types:check` — 类型同步
7. 验证 Agent 13 和 Agent 15 在 wizard steps 文件上的修改无冲突（Agent 13 修改 validators/types.ts，Agent 15 修改 steps/*.tsx 的 icon import）
8. 通过 Chrome DevTools MCP 手动验证：
   - Workflow 创建 wizard 完整流程
   - Debug 页面终端切换
   - WebSocket 重连后事件接收
