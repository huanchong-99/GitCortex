# V1.0.0 Testing — Difficulties, Blockers & Time Analysis

**Date**: 2026-03-29
**Test Sessions**: 2026-03-23 ~ 2026-03-29 (multiple sessions, context resets due to terminal crashes)

---

## 1. DIY Mode — Completely Broken at Start

### 1.1 FK Constraint Failure (code 787)
- **Symptom**: DIY wizard "创建工作流" button always returned `FOREIGN KEY constraint failed`
- **Root Cause**: Frontend wizard generates random UUIDs as `task.id` for internal tracking. Backend mapped these to `vk_task_id` which has FK to `tasks` table. Random UUIDs don't exist in `tasks` → FK violation.
- **Misdiagnosis**: Initially blamed on `customApiKey` field because removing it from the request "fixed" it. Actually, the wizard only sends `customApiKey` AND `task.id` together — the correlation was coincidental. Took ~2 hours to find real cause.
- **Fix**: Validate UUID exists in `tasks` table before binding as `vk_task_id`. File: `crates/server/src/routes/workflows.rs:948-964`
- **Time wasted**: ~3 hours (including multiple failed hypotheses)

### 1.2 DIY Terminals Never Receive Instructions
- **Symptom**: After starting DIY workflow, terminals showed Claude Code idle prompt — no task was sent.
- **Root Cause**: DIY start handler only transitioned status (`pending→running`, `waiting→working`) but never sent task descriptions to terminals. Agent-Planned mode has `OrchestratorAgent.dispatch_terminal()` for this; DIY mode had nothing.
- **Fix**: Added auto-dispatch loop in DIY start handler. File: `crates/server/src/routes/workflows.rs:1841-1886`
- **Time**: ~30 min to identify and fix

### 1.3 DIY Terminals Never Mark as Completed
- **Symptom**: All 3 terminals finished work (Claude Code returned to idle), but UI showed "执行中" forever. Workflow never completed.
- **Root Cause**: No completion detection in DIY mode. Agent-Planned mode uses OrchestratorAgent's quiet-window pattern (40s no output → completed). DIY mode had zero detection.
- **How discovered**: User reported "all 3 terminals have finished but status won't change"
- **Fix**: Background `tokio::spawn` task that polls terminal log timestamps every 15s. 60s of silence → mark terminal completed → cascade to task → cascade to workflow. File: `crates/server/src/routes/workflows.rs:1888-1987`
- **Time**: ~40 min

---

## 2. PromptWatcher — Permission Prompts Blocking Execution

### 2.1 "bypass permissions on" Not Auto-Approved
- **Symptom**: Terminals stalled every few minutes. Debug page showed `bypass permissions on (shift+tab to cycle)` at bottom. Had to manually send Enter via debug page repeatedly.
- **Root Cause**: PromptWatcher required BOTH `is_bypass_permissions_prompt()` AND `is_bypass_permissions_enter_confirm_context()` (checks for "interrupted" / "press enter to confirm"). Claude Code's bypass prompt contains neither of these confirmation keywords.
- **Fix**: Removed `enter_confirm_context` requirement when `auto_confirm=true`. File: `crates/services/src/services/terminal/prompt_watcher.rs:1454-1459` and `:1964-1968`
- **Side effect**: Bypass is a status-line that gets redrawn on every screen update. PromptWatcher now sends Enter on every redraw — harmless but noisy (dozens of unnecessary Enter presses). Need smarter detection to distinguish status-line redraws from actual prompts.
- **Time**: ~1.5 hours (including CI test fix for `test_process_output_bypass_status_line_does_not_auto_enter` and handoff stall priority fix)

### 2.2 PromptWatcher Registration Timing
- **Symptom**: Even after the bypass fix, first few prompts were missed.
- **Root Cause**: `refresh_prompt_watcher_registrations()` was called AFTER auto-dispatch code (which has 2s delays per terminal). Prompts appeared during dispatch before watcher was registered.
- **Fix**: Moved `refresh_prompt_watcher_registrations()` call before auto-dispatch. File: `crates/server/src/routes/workflows.rs:1837-1839`
- **Time**: ~20 min

### 2.3 Handoff Stall Priority Conflict
- **Symptom**: CI test `test_process_output_handoff_stall_with_bypass_status_line_sends_immediate_enter` failed after bypass fix.
- **Root Cause**: When a chunk contains both handoff stall prompt AND bypass indicator, the bypass Enter fired first (chunk-level detection), preventing the more important handoff stall handler from running.
- **Fix**: Added `!has_handoff_stall_context` guard to bypass detection. File: `crates/services/src/services/terminal/prompt_watcher.rs:1463` and `:1969`
- **Time**: ~30 min

---

## 3. Planning Draft Lifecycle — Confirm≠Materialize

### 3.1 Confirmed but Never Materialized
- **Symptom**: Task 2 (Hoppscotch) planning draft stuck at `confirmed` for 10+ minutes. Workflow never created.
- **Root Cause**: `POST /confirm` and `POST /materialize` are separate API endpoints. Frontend calls confirm but does NOT auto-call materialize. User must click another button or it must be triggered programmatically.
- **Workaround**: Manually called `POST /materialize` via curl.
- **Not fixed**: This is a frontend UX gap. File: `crates/server/src/routes/planning_drafts.rs:236` (confirm) vs `:664` (materialize)
- **Time wasted**: ~15 min debugging before realizing it was a separate endpoint

---

## 4. GLM-5 Model Performance

### 4.1 Extremely Slow on Large Codebases
- **Task 6 (Kutt, ~2k★ JS project)**: Completed in ~46 min. Acceptable.
- **Task 2 (Hoppscotch, ~78k★ TS monorepo)**: Task 1 (foundation) completed in ~40 min. Task 2 (concurrent engine) ran for **4.5 hours** with no commit, then declared dead.
- **Behavior**: Claude Code showed "thinking" for 20-30 min stretches. GLM-5 via Anthropic-compatible API is much slower than native Anthropic models. Token consumption: 158k+ tokens for a single terminal session.
- **Conclusion**: GLM-5 is viable for small-medium projects only. Large codebases need a faster model.

### 4.2 All Other Models Unusable
- **Sonnet-4.6 via haiio.xyz**: ~50% 504 error rate even with streaming. 60s gateway timeout.
- **Codex via right.codes**: Authentication failures, dashboard inaccessible.
- **Result**: GLM-5 was the ONLY functional model for the entire test. This is a significant limitation.

---

## 5. Server Crashes and Context Loss

### 5.1 Server Restarts Kill Running Workflows
- **Occurred**: Multiple times when rebuilding server code to apply fixes during testing.
- **Impact**: PTY processes killed, workflow transitions to `failed`, terminals reset to `not_started`.
- **Misdiagnosis**: Initially thought workflows were failing due to code bugs. Several "stall" detections in monitoring were actually caused by server restarts for code updates.
- **Lesson**: Never restart server while workflows are running. Apply fixes between test runs, not during.

### 5.2 Claude Code Terminal Crashes (Context Resets)
- **Occurred**: At least 5 times during the multi-day testing period.
- **Impact**: Lost all conversation context, had to re-read progress files, re-identify current state.
- **Mitigation**: `V1test-progress.md` served as recovery point. Memory files also helped.

---

## 6. Browser/UI Issues

### 6.1 Debug Page Showing Wrong Workflow
- **Symptom**: User saw "Disconnected from terminal stream (code 1006)" on debug page.
- **Root Cause**: Browser was still on the URL of a previously deleted workflow. Not a bug — just stale URL.
- **Time wasted**: ~10 min confusion before realizing the URL was wrong.

### 6.2 Wizard Textarea `fill()` Not Working
- **Symptom**: Task description fields appeared empty after using Chrome MCP `fill()`.
- **Root Cause**: Rich text editor (`<textarea>`) doesn't respond to `fill()` the same as `<input>`. Need `click()` + `type_text()` instead.
- **Time wasted**: ~20 min re-doing wizard entries.

---

## 7. Time Breakdown (2026-03-29 Session Only)

| Activity | Duration | Notes |
|----------|----------|-------|
| FK constraint diagnosis + fix | ~3h | Longest single debugging session |
| DIY auto-dispatch + completion monitor | ~1.5h | Two separate features |
| PromptWatcher bypass fix + CI fix | ~2h | Including 3 iterations |
| Task 6 (Kutt) full execution | ~46min | Successful DIY test |
| Task 2 (Hoppscotch) execution | ~4.5h | Partial success, Task2 dead |
| Planning draft lifecycle + materialize | ~30min | Manual workaround |
| Monitoring/waiting (idle) | ~3h | Watching terminals work |
| Server restarts + recovery | ~1h | Code updates between tests |
| Doc reorganization | ~30min | This session's final task |
| **Total session** | **~17h** | From first fix to final commit |

---

## 8. Key Lessons

1. **DIY mode was fundamentally incomplete** — missing 3 critical features (dispatch, completion, prompt handling). Agent-Planned mode worked because OrchestratorAgent handled all of this.
2. **PromptWatcher pattern matching is fragile** — Claude Code's TUI changes between versions. The "bypass permissions" prompt format wasn't anticipated by existing patterns.
3. **Model availability is the real bottleneck** — 4 out of 5 configured models were unusable. The one working model (GLM-5) is too slow for production-scale testing.
4. **60s quiet-window is a heuristic** — works for fast models but may false-positive during long GLM-5 thinking phases. The bypass status-line redraws help keep the terminal "alive" during thinking, but that's accidental.
5. **Server restarts during testing create confusion** — stall detection reports server-crash-induced failures as "terminal stalls", wasting investigation time.
6. **Planning Draft confirm→materialize gap is a UX bug** — should be a single action or auto-chained.
