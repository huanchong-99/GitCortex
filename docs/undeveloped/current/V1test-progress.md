# V1.0.0 Test Progress

**Last Updated**: 2026-03-28 06:30 UTC

## Step 1: Bug Fixes ✅ (5 fixes applied)

| Fix | Description | File(s) |
|-----|-------------|---------|
| 1A | Concierge WS rapid disconnect — merged effects + debounce + polling | ConciergeChatContainer.tsx, conciergeWsStore.ts, useConcierge.ts |
| 1B | Filesystem cancellation log noise — debug→trace | filesystem.rs:391 |
| 1C | CC-Switch URL double-pathing — strip /v1 for Claude Code | cc_switch.rs:262-270 |
| 1D | Stale model configs cleanup — deleted Wizard-Test-Model, Wizard-GLM5 | DB cleanup |
| 1E | Base URL fix — /v1 for internal LLM, stripped for CLI terminals | Model settings |

## Step 2: Clean Test Directories ✅
- All 7 task directories cleaned + repos cloned/initialized

## Step 3: Local Testing — First Pass Complete (6/7 tasks)

### Results Summary

| Order | Task | Mode | Workflow Status | Tasks | Code Generated | Merge |
|-------|------|------|----------------|-------|---------------|-------|
| 1st | Task 4 (Refactor+Test) | Agent-Planned | ✅ completed | 8/8 ✅ | 2 commits | ⚠️ failed |
| 2nd | Task 3 (Express→Rust) | Agent-Planned | ⚠️ failed | 5/5 ✅ | Rust project init | ⚠️ failed |
| 3rd | Task 1 (Knowledge Base) | Agent-Planned | ⚠️ failed | 6/6 ✅ | Full app | ⚠️ failed |
| 4th | Task 7 (Web Memo) | Agent-Planned | ⚠️ failed | 2/3 + 1 running | Partial | ⚠️ failed |
| 5th | Task 5 (Microservices) | Agent-Planned | ✅ completed | 5/5 ✅ | Microservices | ✅ (or skipped) |
| 6th | Task 2 (Hoppscotch) | Agent-Planned | 🔄 running | 2/5 + 3 running | In progress | — |
| 7th | Task 6 (Kutt Security) | DIY | ⏳ not started | — | — | — |

### Key Findings

**Working Well:**
- Planning Draft lifecycle (gathering→spec_ready→confirmed→materialized) works flawlessly
- GLM-5 direct execution — no unnecessary questions for precise requirements
- Orchestrator progressive decomposition — creates tasks and dispatches terminals correctly
- CC-Switch correctly configures Claude Code CLI with API key and base URL
- Multiple concurrent workflows supported (up to 3 parallel)
- Git commit detection and terminal completion tracking work

**Issues Found (ordered by severity):**

1. **CRITICAL: Auto-merge fails in no-worktree mode** — All workflows fail at merge because the orchestrator expects per-task branches but Claude Code commits directly to `gitcortex-demo`. No actual branches like `feat/service-repo-layers` are created. Code IS written correctly; it's just the merge bookkeeping that fails.

2. **HIGH: Password prompt stall** — When Claude Code CLI encounters a password prompt (e.g., PostgreSQL connection), the PromptWatcher detects it as `Password` kind and decides `AskUser`, causing the terminal to stall indefinitely with no automatic recovery.

3. **MEDIUM: GLM-5 stall recovery noise** — 40-second quiet window triggers frequent stall recovery for GLM-5 (which is slower than native Anthropic API). Terminals get re-dispatched instructions when they're actually still working.

4. **LOW: Task 7 has 1 running task stuck** — Workflow marked failed but 1 task still shows "running" in DB.

### Test Execution Timeline
- 01:08 UTC: Task 4 started
- 01:31 UTC: Task 4 completed (~23 min)
- 01:35 UTC: Task 3 started
- 01:55 UTC: Task 1 started (parallel with Task 3)
- ~03:30 UTC: Task 3 code completed
- ~04:10 UTC: Task 1 completed (6 tasks)
- 04:15 UTC: Task 7 started
- 04:20 UTC: Task 5 started (parallel with Task 7)
- ~05:00 UTC: Task 5 completed (5 tasks, ~40 min)
- 05:15 UTC: Task 2 started
- 06:30 UTC: Task 2 still running

## Step 4: Docker Testing — NOT STARTED
Pending completion of local testing first pass.

## Next Steps
1. Wait for Task 2 to complete
2. Fix auto-merge issue (skip merge when no worktrees exist)
3. Start Task 6 (DIY mode)
4. Clean data, retest all with fixes
5. Then proceed to Docker testing
