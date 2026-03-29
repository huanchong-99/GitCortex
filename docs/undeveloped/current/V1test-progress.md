# V1.0.0 Test Progress

**Last Updated**: 2026-03-29 12:50 UTC

## API Configuration (FINAL — 2026-03-28)

**ALL 5 models are unstable. No stable/unstable distinction. Full disaster recovery failover.**

| # | Name | CLI | Model ID | Base URL |
|---|------|-----|----------|----------|
| 1 | Sonnet-4.6-A | Claude Code | claude-sonnet-4-6 | https://ww.haiio.xyz/v1 |
| 2 | Sonnet-4.6-B | Claude Code | claude-sonnet-4-6 | https://ww.haiio.xyz/v1 |
| 3 | Codex-GPT5.3 | Codex | gpt-5.3-codex-xhigh | https://right.codes/codex/v1 |
| 4 | Codex-GPT5.4 | Codex | gpt-5.4-xhigh | https://right.codes/codex/v1 |
| 5 | GLM-5 | Claude Code | glm-5 | https://open.bigmodel.cn/api/anthropic/v1 |

**Design:** ResilientLLMClient handles all failover. Codex CLI actively used. haiio.xyz has 60s gateway timeout. LLM client uses streaming mode.

## Bug Fixes Applied (all pushed to remote, CI green)
1. Concierge WS rapid disconnect fix
2. Filesystem cancellation log noise reduction
3. CC-Switch URL /v1 stripping for Claude Code terminals
4. Auto-merge skip for non-existent branches (no-worktree mode)
5. Anthropic-compatible LLM client switched to streaming mode (504 fix)
6. SonarCloud: 4 issues fixed (negated condition, String.raw, complexity extractions)
7. Multiple CreateChatBoxContainer complexity reductions
8. DIY wizard FK constraint fix (vk_task_id referencing non-existent VK tasks)
9. DIY mode auto-dispatch task instructions to terminals
10. PromptWatcher early registration before instruction dispatch
11. Bypass permissions auto-confirm in autoConfirm mode
12. Handoff stall priority over bypass auto-enter
13. DIY quiet-window completion monitor (60s silence → mark completed)

## Step 3: Local Testing — Sequential Execution

| Order | Task | Status | Notes |
|-------|------|--------|-------|
| 1st | Task 4 (Refactor+Test) | ✅ Completed | 4/4 tasks, 5 commits |
| 2nd | Task 3 (Express→Rust) | ✅ Completed | 2/2 tasks |
| 3rd | Task 1 (Knowledge Base) | ✅ Completed | 6 tasks |
| 4th | Task 7 (Web Memo) | ⏸ Skipped | Not retested |
| 5th | Task 5 (Microservices) | ⏳ Pending | Not started |
| 6th | Task 6 (Kutt Security) | ✅ Completed | DIY mode, 3 tasks parallel, GLM-5, ~46min |
| 7th | Task 2 (Hoppscotch) | ⚠ Partial | Task1 committed (ba06e58c7), Task2 dead after 4.5h (GLM-5 stuck in loop) |

**Summary: 4/7 completed, 1 partial, 2 not done. GLM-5 is too slow for large codebase tasks (Hoppscotch 78k★).**

## Known Issues
1. haiio.xyz proxy has 60s gateway timeout — long requests may 504 even with streaming
2. "signal timed out" raw error shown in workspace chat (should be user-friendly message)
3. ~~Workflow auto-sync to completed can happen while tasks still running~~ (fixed)
4. DIY mode bypass permissions status line triggers PromptWatcher false positives (harmless but noisy)
5. GLM-5 cannot handle large codebases (Hoppscotch) — gets stuck in infinite thinking loops
6. Planning Draft confirm→materialize requires separate API call (UI doesn't auto-trigger materialize)

## Step 4: Docker Testing — NOT STARTED
