# Phase 24: 终端自动确认与消息桥接

> **状态:** 📋 待实施
> **优先级:** 🔴 高（核心功能缺陷修复）
> **目标:** 实现 Orchestrator 与 PTY 终端的双向通信，解决 CLI 工具需要二次确认的问题
> **发现时间:** 2026-02-05
> **前置条件:** Phase 23 终端进程隔离修复完成
> **参考项目:** [Auto-Claude](https://github.com/AndyMik90/Auto-Claude)
> **讨论记录:** 与 Codex 进行了 3 轮讨论，达成最终共识

---

## 问题背景

### 当前问题

1. **终端 PTY 启动时没有自动确认参数**
   - Claude Code 需要 `--dangerously-skip-permissions`
   - Codex 需要 `--yolo` 或 sandbox 策略
   - Gemini CLI 需要 `--yolo`

2. **Orchestrator 无法真正向 PTY 发送确认**
   - Orchestrator 会发布 `TerminalMessage` 到消息总线
   - 但没有组件订阅这个消息并写入 PTY
   - 所以即使 Orchestrator 想发送确认，也无法到达 CLI

3. **关键代码位置**
   - `crates/services/src/services/orchestrator/agent.rs:858-872` - 发送消息
   - `crates/server/src/routes/workflow_events.rs:211` - 明确忽略该消息
   - `crates/server/src/routes/terminal_ws.rs` - 只接收 WebSocket 输入，不读取消息总线

4. **关键澄清：确认方式是 Enter 键，不是输入 "y"**
   - 很多 CLI 提示需要按 Enter 键确认，发送 `\n`
   - 不是所有确认都是 y/n 选择

### Auto-Claude 的解决方案

Auto-Claude 使用 Claude Agent SDK（Python SDK）与 Claude 交互，不是直接启动 PTY 进程。它的 Orchestrator 是 Python 代码，处理所有 bookkeeping（记忆、提交、进度），Agent 只专注于实现代码。

GitCortex 使用 PTY 方式启动 CLI 工具，需要建立 MessageBus → PTY 输入桥来实现类似功能。

---

## 核心设计决策（与 Codex 3 轮讨论结论）

### 1. 提示类型分类（6 种）

| 类型 | 响应方式 | 示例 |
|------|----------|------|
| `EnterConfirm` | 只需要 `\n` | "Press Enter to continue..." |
| `YesNo` | 需要 `y\n` 或 `n\n` | "[y/n]", "(yes/no)" |
| `Choice` | 需要输入字母/数字 + `\n` | "Select (A/B/C):", "Choose [1-3]:" |
| `ArrowSelect` | 需要箭头键序列 + `\n` | "> React / Vue / Angular"（上下箭头选择） |
| `Input` | 需要自由文本 + `\n` | "Enter your name:" |
| `Password` | 必须用户介入 | "Enter password:" |

**判定优先级（高到低）**：`Password` → `Input` → `ArrowSelect` → `Choice` → `YesNo` → `EnterConfirm`

### ArrowSelect 详细说明（新增）

**检测信号**：
1. **提示语信号**：文案包含 `Use arrow keys`、`Use ↑/↓`、`(Use arrow keys)`
2. **结构信号**：连续多行选项 + 选中标记前缀
   - 选中标记：`>`, `*`, `❯`, `▸`, `→`, `[x]`, `(x)`, `●`
   - 未选中标记：` ` (空格), `[ ]`, `( )`, `○`

**示例输出**：
```
? Select a framework: (Use arrow keys)
> React
  Vue
  Angular
  Svelte
```

**响应流程**：
1. PromptDetector 解析选项列表和当前选中项（`selected_index`）
2. Orchestrator 调用 LLM，LLM 返回目标选项的 `option_id` 或 `index`
3. Orchestrator 计算从当前位置到目标位置需要的箭头键数量
4. 发送箭头键序列 + `\n`

**箭头键 ANSI 转义序列**：
- 上箭头：`\x1b[A`（ESC [ A）
- 下箭头：`\x1b[B`（ESC [ B）

**计算逻辑**：
```rust
fn build_arrow_sequence(current: usize, target: usize) -> String {
    if target > current {
        "\x1b[B".repeat(target - current)  // Down
    } else if target < current {
        "\x1b[A".repeat(current - target)  // Up
    } else {
        String::new()
    }
}
```

**与 Choice 的区别**：
- `Choice`：单行提示，要求输入字母/数字（如 `A`, `1`）
- `ArrowSelect`：多行选项块，有选中标记，需要箭头键导航

### 2. 双路径架构

```
┌─────────────────────────────────────────────────────────────┐
│                      GitCortex 终端交互架构                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  路径 A: Claude Code Hooks（权限提示）                        │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Claude Code │───▶│PermissionReq │───▶│ Hook 自动批准  │  │
│  │   CLI       │    │   Event      │    │ (allow)       │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│                                                             │
│  路径 B: PTY PromptDetector（其他交互）                       │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ PTY 输出    │───▶│PromptDetector│───▶│ Orchestrator  │  │
│  │             │    │              │    │ 智能决策       │  │
│  └─────────────┘    └──────────────┘    └───────┬───────┘  │
│                                                  │          │
│                     ┌──────────────┐    ┌───────▼───────┐  │
│                     │ PTY stdin    │◀───│TerminalInput  │  │
│                     │              │    │ Bridge        │  │
│                     └──────────────┘    └───────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. 响应策略

| 提示类型 | 策略 |
|----------|------|
| `EnterConfirm` 高置信度 + 无危险关键词 | 直接发送 `\n` |
| `EnterConfirm` 低置信度或有危险关键词 | LLM 决策或 ask_user |
| `YesNo` | LLM 决策 |
| `Choice` | LLM 决策（理解上下文选择选项） |
| `ArrowSelect` | LLM 决策目标选项 → 计算箭头序列 → 发送 |
| `Input` | LLM 决策（生成合适内容） |
| `Password` | 必须 ask_user |

**ArrowSelect 特殊处理**：
- LLM 只返回目标选项的 `option_id` 或 `index`，不直接输出转义序列
- Orchestrator 计算箭头键序列，避免 LLM 注入控制字符

### 4. 安全关键词

**危险关键词**（触发 ask_user 或 LLM 决策）：
`delete`, `remove`, `destroy`, `wipe`, `format`, `drop`, `overwrite`, `reset`, `publish`, `deploy`, `merge`, `push`

**敏感输入关键词**（强制 ask_user）：
`password`, `token`, `secret`, `api key`, `credential`

### 5. 状态管理策略

- `waiting_for_approval` 和 `stalled` 先作为 **Orchestrator 内存状态**，不落库
- 避免新增 DB 枚举和迁移的复杂度
- 通过 WebSocket 事件广播状态变化给前端

---

## 实施计划

### P0 - MessageBus → PTY 输入桥（核心）

> **目标:** 让 Orchestrator 发送的 TerminalMessage 能够真正到达 PTY stdin

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 24.1 | 创建 `terminal/bridge.rs` 模块 - 订阅 `pty_session_id` 主题 | ⬜ |  |
| 24.2 | 实现 `BusMessage::TerminalMessage` 到 PTY stdin 的写入 | ⬜ |  |
| 24.3 | 处理行尾补齐（无 `\n` 时自动追加，Windows 下使用 `\r\n`） | ⬜ |  |
| 24.4 | 处理写入失败与终端不存在的情况 - 更新状态为 `failed` 或 `waiting` | ⬜ |  |
| 24.5 | 维护活跃 session 的 map，终端退出或 writer 报错时清理 | ⬜ |  |
| 24.6 | 在 `TerminalLauncher` 启动后注册桥接任务 | ⬜ |  |
| 24.7 | 在 `/api/terminals/:id/start` 手动启动路径也注册桥接 | ⬜ |  |

**需要修改的文件:**
- `crates/services/src/services/terminal/bridge.rs` (新建)
- `crates/services/src/services/terminal/mod.rs`
- `crates/services/src/services/terminal/process.rs`
- `crates/services/src/services/terminal/launcher.rs`
- `crates/server/src/routes/terminals.rs`
- `crates/server/src/main.rs`
- `crates/local-deployment/src/lib.rs`

**预期测试用例:**
- `crates/services/tests/terminal_message_bridge_test.rs` - 验证向 `pty_session_id` 发布 `TerminalMessage` 后 PTY 收到输入并产生输出
- `crates/services/tests/terminal_message_bridge_error_test.rs` - 验证终端不存在或 writer 失败时状态更新与错误广播
- `crates/services/tests/terminal_lifecycle_test.rs` - 补充桥接后的全流程验证

---

### P0 - CLI 自动确认参数

> **目标:** 在 `build_launch_config` 中为各 CLI 注入自动确认参数

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 24.8 | Claude Code 追加 `--dangerously-skip-permissions` 参数 | ⬜ |  |
| 24.9 | Codex 追加 `--yolo` 参数 | ⬜ |  |
| 24.10 | Gemini CLI 追加 `--yolo` 参数 | ⬜ |  |
| 24.11 | 增加全局或 per-workflow 的自动确认开关（默认开启） | ⬜ |  |
| 24.12 | 确保 `/api/terminals/:id/start` 手动启动路径也带上参数 | ⬜ |  |

**需要修改的文件:**
- `crates/services/src/services/cc_switch.rs`
- `crates/services/src/services/config/versions/v8.rs`
- `crates/services/src/services/config/mod.rs`
- `crates/services/src/services/terminal/launcher.rs`
- `crates/server/src/routes/terminals.rs`

**预期测试用例:**
- `crates/services/tests/cc_switch_build_launch_config_test.rs` - 验证三种 CLI 的 args 中包含期望的自动确认参数
- `crates/services/tests/terminal_launch_config_test.rs` - 验证手动启动路径也包含自动确认参数

---

### P1 - 智能提示检测与 Orchestrator 决策

> **目标:** 从 PTY 输出识别 6 种提示类型，由 Orchestrator 做出智能决策

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 24.13 | 创建 `terminal/prompt_detector.rs` 模块 | ⬜ |  |
| 24.14 | 实现 `EnterConfirm` 检测（Press Enter, Hit Enter, [Enter] 等） | ⬜ |  |
| 24.15 | 实现 `YesNo` 检测（[y/n], (yes/no) 等） | ⬜ |  |
| 24.16 | 实现 `Choice` 检测（A/B/C, 1/2/3 选项列表） | ⬜ |  |
| 24.17 | 实现 `ArrowSelect` 检测（多行选项块 + 选中标记 `>`, `*`, `❯` 等） | ⬜ |  |
| 24.18 | 实现 `ArrowSelect` 选项解析（提取选项列表和 `selected_index`） | ⬜ |  |
| 24.19 | 实现 `Input` 检测（Enter your name:, Provide path: 等） | ⬜ |  |
| 24.20 | 实现 `Password` 检测（password, token, secret 等敏感输入） | ⬜ |  |
| 24.21 | 创建 `terminal/prompt_watcher.rs` - 监控 PTY 输出并发布 `TerminalPromptDetected` 事件 | ⬜ |  |
| 24.22 | 在 Orchestrator 中处理 `TerminalPromptDetected` 事件 | ⬜ |  |
| 24.23 | 实现规则优先策略：`EnterConfirm` 高置信度直接发送 `\n` | ⬜ |  |
| 24.24 | 实现危险关键词检测，触发 LLM 决策或 ask_user | ⬜ |  |
| 24.25 | 实现 LLM 决策调用（专用提示模板，返回 JSON 决策） | ⬜ |  |
| 24.26 | 实现 `ArrowSelect` 响应：LLM 返回目标 index → 计算箭头序列 → 发送 | ⬜ |  |
| 24.27 | 实现 `build_arrow_sequence` 函数（计算 `\x1b[A` / `\x1b[B` 序列） | ⬜ |  |
| 24.28 | `Password` 类型强制 ask_user，广播 `TerminalStatusUpdate` | ⬜ |  |
| 24.29 | 前端显示 `waiting_for_approval` 状态的 UI | ⬜ |  |
| 24.30 | 维护每个 terminal 的 prompt 状态机，避免抖动和重复响应 | ⬜ |  |

**提示检测正则表达式参考:**
```rust
// EnterConfirm - 只需要发送 \n
static ENTER_CONFIRM_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(press|hit|tap)\s+(the\s+)?(enter|return)\b|\[enter\]|\benter\s+to\s+(continue|proceed|resume|exit)\b|\bpress\s+any\s+key\b").unwrap()
});

// YesNo - 需要发送 y\n 或 n\n
static YES_NO_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\[(y/n|yes/no)\]|\(y/n\)|\byes/no\b").unwrap()
});

// ArrowSelect - 检测箭头键提示
static ARROW_HINT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(use|press)\s+(arrow\s+keys|↑|↓)\b").unwrap()
});

// ArrowSelect - 选中标记检测
static SELECT_MARKER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^(?P<mark>>|\*|❯|▸|→|\[x\]|\[\s\]|\(x\)|\(\s\)|●|○)\s+(?P<label>.+)$").unwrap()
});

// Input - 需要自由文本 + \n（注意排除 EnterConfirm）
static INPUT_FIELD_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(enter|provide|input)\b.*(:|>\s*$)").unwrap()
});

// Password - 必须 ask_user
static PASSWORD_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(password|passphrase|token|secret|api key|credential)\b").unwrap()
});

// Choice - 需要选项 + \n
static CHOICE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(choose|select|option)\b").unwrap()
});
```

**需要修改的文件:**
- `crates/services/src/services/terminal/prompt_detector.rs` (新建)
- `crates/services/src/services/terminal/prompt_watcher.rs` (新建)
- `crates/services/src/services/terminal/mod.rs`
- `crates/services/src/services/orchestrator/types.rs` - 新增 PromptKind, TerminalPrompt, PromptDecision 类型
- `crates/services/src/services/orchestrator/message_bus.rs` - 新增 TerminalPromptDetected, TerminalInput 消息
- `crates/services/src/services/orchestrator/agent.rs` - 处理提示事件和决策
- `crates/services/src/services/terminal/bridge.rs`
- `frontend/src/components/workflow/TerminalCard.tsx`
- `frontend/src/components/board/TerminalDots.tsx`
- `frontend/src/components/board/TerminalActivityPanel.tsx`
- `frontend/src/components/pipeline/TerminalNode.tsx`
- `frontend/src/pages/WorkflowDebugPage.tsx`
- `frontend/src/components/ui-new/utils/workflowStatus.ts`
- `frontend/src/i18n/locales/en/workflow.json`
- `frontend/src/i18n/locales/zh-Hans/workflow.json`

**预期测试用例:**
- `crates/services/tests/terminal_prompt_detector_test.rs` - 覆盖 5 种提示类型的识别与误报场景
- `crates/services/tests/terminal_prompt_watcher_test.rs` - 验证 PTY 输出监控和事件发布
- `crates/services/tests/orchestrator_prompt_decision_test.rs` - 验证 Orchestrator 对不同提示类型的决策
- `frontend/src/components/workflow/TerminalCard.test.tsx` - 验证 `waiting_for_approval` 的 UI 显示

---

### P2 - 超时告警机制

> **目标:** 终端 `working` 且长时间无输出时提示异常

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 24.31 | 在 PTY 输出监控里记录 `last_output_at` | ⬜ |  |
| 24.32 | 超过阈值（默认 120s）无输出时标记为 `stalled` 状态（内存状态） | ⬜ |  |
| 24.33 | 写入系统日志并广播 `TerminalStatusUpdate` | ⬜ |  |
| 24.34 | 输出恢复时自动回到 `working` | ⬜ |  |
| 24.35 | 前端显示 `stalled` 状态的 UI（黄色警告图标） | ⬜ |  |

**需要修改的文件:**
- `crates/services/src/services/terminal/prompt_watcher.rs`
- `crates/services/src/services/terminal/process.rs`
- `crates/services/src/services/orchestrator/types.rs`
- `frontend/src/components/workflow/TerminalCard.tsx`
- `frontend/src/components/ui-new/utils/workflowStatus.ts`
- `frontend/src/i18n/locales/en/workflow.json`
- `frontend/src/i18n/locales/zh-Hans/workflow.json`

**预期测试用例:**
- `crates/services/tests/terminal_idle_monitor_test.rs` - 验证超过阈值后状态切换为 stalled
- `crates/services/tests/terminal_idle_recovery_test.rs` - 验证输出恢复后状态回到 `working`

---

### P3 - 测试与回归

| Task | 目标描述 | 状态 | 完成时间 |
|------|----------|------|----------|
| 24.36 | 新增 MessageBus → PTY 桥接单测 | ⬜ |  |
| 24.37 | 新增 CLI 自动确认参数单测 | ⬜ |  |
| 24.38 | 新增 6 种提示类型检测单测 | ⬜ |  |
| 24.39 | 新增 ArrowSelect 选项解析与箭头序列生成单测 | ⬜ |  |
| 24.40 | 新增 Orchestrator 智能决策单测 | ⬜ |  |
| 24.41 | 新增超时告警机制单测 | ⬜ |  |
| 24.42 | 端到端测试：工作流创建 -> 终端启动 -> 自动确认 -> 命令执行 | ⬜ |  |
| 24.43 | CI 回归验证 | ⬜ |  |

---

## 风险与回滚策略

### 风险清单

1. **安全风险**: `--dangerously-skip-permissions` 等参数会跳过安全确认
   - 缓解: 增加全局开关，默认开启但可配置关闭
   - 缓解: 在 UI 中显式标记风险

2. **兼容性风险**: 不同版本的 CLI 工具参数可能不同
   - 缓解: 检测 CLI 版本，根据版本选择参数
   - 缓解: 参数不存在时优雅降级

3. **状态机复杂度**: 新增 `waiting_for_approval` 和 `stalled` 状态
   - 缓解: 先作为 Orchestrator 内存状态，不落库
   - 缓解: 增加状态转换日志

4. **PTY 多读者风险**: 不同 PTY 实现对多读者支持不一致
   - 缓解: PromptDetector 挂到现有输出流旁路复制
   - 缓解: 建立中心 fanout，避免多个 reader 竞争

5. **EnterConfirm 误判风险**: "Enter your name:" 可能被误判为 EnterConfirm
   - 缓解: 判定规则顺序固定为 Password → Input → Choice → YesNo → EnterConfirm
   - 缓解: Input 检测优先于 EnterConfirm

6. **Claude Hooks 事件名不一致风险**: 事件名必须与 CLI 实际一致
   - 缓解: 初期加日志输出 hook payload，确认真实事件名
   - 缓解: 实测验证后再固化

7. **Windows 换行符风险**: 某些 CLI 需要 `\r\n` 而非 `\n`
   - 缓解: 在 TerminalInput 结构中保留 newline_mode 字段
   - 缓解: 默认 `\n`，可配置为 `\r\n`

### 回滚策略

1. 如果 P0 任务出现问题，可以通过配置关闭自动确认参数
2. 如果桥接出现问题，可以回退到纯 WebSocket 输入模式
3. 所有新增状态都是内存状态，不影响现有数据库

---

## 预期收益

- ✅ 工作流启动后终端能够自动执行，无需人工确认
- ✅ Orchestrator 能够真正向终端发送指令（通过 TerminalInputBridge）
- ✅ 智能识别 5 种提示类型，做出正确响应（Enter/y/选项/文本）
- ✅ 用户能够看到终端等待确认的状态
- ✅ 长时间无输出时能够及时发现问题
- ✅ 敏感操作（密码、危险命令）强制用户确认，保障安全
- ✅ 提升整体自动化程度和用户体验

---

## 任务统计

- **P0 任务**: 12 个（MessageBus → PTY 桥接 7 个 + CLI 自动确认参数 5 个）
- **P1 任务**: 18 个（智能提示检测与 Orchestrator 决策，含 ArrowSelect）
- **P2 任务**: 5 个（超时告警机制）
- **P3 任务**: 8 个（测试与回归）
- **总计**: 43 个任务

---

## 参考资料

- [Auto-Claude 项目](https://github.com/AndyMik90/Auto-Claude)
- [Claude Code CLI 文档](https://docs.anthropic.com/claude-code)
- [Claude Code Hooks 参考](https://code.claude.com/docs/en/hooks)
- [Codex CLI 文档](https://github.com/openai/codex)
- [Gemini CLI 文档](https://cloud.google.com/gemini)
