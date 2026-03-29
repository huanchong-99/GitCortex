# Full-Scale Audit Report — Wave 1 (Core Backend)

**Date:** 2026-03-29
**Scope:** 10 audit agents covering orchestrator, terminal, concierge, git, events, message bus, CC-switch, integrations
**Lines Reviewed:** ~45,000+ lines of Rust

---

## Executive Summary

| Agent | Zone | Score | Rating | P0 | P1 | P2 | P3 | Total |
|-------|------|-------|--------|----|----|----|----|-------|
| 1 | Orchestrator Agent Core | 76 | B | 3 | 5 | 7 | 3 | 18 |
| 2 | Orchestrator Runtime & State | 80.75 | B | 0 | 3 | 6 | 7 | 16 |
| 3 | Orchestrator Tests & LLM | 82 | B | 0 | 3 | 5 | 5 | 13 |
| 4 | **Terminal PromptWatcher** | **54** | **C (REJECT)** | **3** | **5** | **5** | **5** | **18** |
| 5 | Terminal Process & Launcher | 79 | B | 0 | 3 | 5 | 5 | 13 |
| 6 | **Concierge Agent** | **64.9** | **C** | **3** | **4** | **6** | **5** | **18** |
| 7 | Git Services | 79 | B | 2 | 4 | 5 | 5 | 16 |
| 8 | Container & Workspace | 79 | B | 2 | 4 | 6 | 4 | 16 |
| 9 | **CC-Switch & Integrations** | **66.6** | **C** | **3** | **6** | **8** | **5** | **22** |
| 10 | Events & Message Bus | 80 | B | 0 | 3 | 6 | 4 | 13 |
| **TOTAL** | | | | **16** | **40** | **59** | **48** | **163** |

**3 modules REJECTED (C rating):** PromptWatcher, Concierge, CC-Switch
**7 modules CONDITIONAL PASS (B rating):** All others

---

## P0 Critical Issues (16 total)

### Orchestrator Agent Core (3)
1. **`handle_message` silently swallows 8 message types via `_ => {}`** — Any new BusMessage variant is silently dropped. `BusMessage::Instruction` exists but is never processed.
2. **`handle_terminal_completed_skip_quiet_window` potential infinite recursion** — If quality gate completes instantly, quiet-window check loops.
3. **Double commit processing race window** — Same commit can trigger two LLM calls due to quiet-window async delay + new commit arrival.

### Terminal PromptWatcher (3)
4. **`normalize_text_for_detection` strips newlines, causing cross-line false positives** — Multi-line output gets flattened, so unrelated fragments across lines match combined patterns. ROOT CAUSE of V1 false positive problem.
5. **Handoff stall detection ignores `auto_confirm=false`** — Users in manual mode get automated responses injected without consent.
6. **Hardcoded menu position `"2\r"` in `claude_bypass_accept_response`** — Assumes "Yes, I accept" is always menu item #2. Will break on any Claude CLI update.

### Concierge Agent (3)
7. **Stale session state after tool mutations** — If `toggle_feishu_sync` tool runs, the final broadcast uses the original (stale) session value.
8. **Naive JSON parser breaks on strings containing braces** — `extract_inline_json` counts `{`/`}` without handling JSON string escaping.
9. **Unsanitized `repo_path` passed to `git init`** — LLM-provided path goes directly to `create_dir_all` + `git init` with zero validation. Path traversal possible.

### Git Services (2)
10. **Event loss silently swallowed on publish failure** — If message bus has no subscribers, commit events are permanently lost. GitWatcher advances cursor anyway. Workflow hangs forever.
11. **`.git` detection fails semantically for git worktrees** — `.git` is a file in worktrees, not a directory. Current code works by accident (`exists()` passes) but is fragile.

### Container & Workspace (2)
12. **`std::sync::Mutex` in filesystem_watcher exposed to async callers** — Returned `Arc<Mutex<Debouncer>>` can block tokio worker threads if locked from async context.
13. **`should_finalize` panics on invalid `executor_action()` JSON** — Direct `unwrap()` on JSON parse result from database field. Corrupted data = server crash.

### CC-Switch & Integrations (3)
14. **API keys logged in plaintext** — First 4 characters of every API key written to logs. Short keys may be fully exposed.
15. **API keys written to disk without cleanup** — Temporary files containing plaintext API keys persist indefinitely. Only Codex has cleanup guard.
16. **Merge coordinator lock not enforced internally** — `acquire_workflow_merge_lock()` exists but `merge_task_branch()` doesn't call it. Concurrent merges can corrupt git state.

---

## P1 High Issues (40 total — top highlights)

| # | Zone | Issue |
|---|------|-------|
| 1 | Orchestrator | `let _ = self.execute_instruction(&resp2).await` swallows errors in initial planning |
| 2 | Orchestrator | `auto_complete_stalled_tasks` marks empty tasks as "completed" instead of "failed" |
| 3 | Orchestrator | `awaken()` method is a no-op — does nothing, called from review handlers |
| 4 | Orchestrator | Windows `force_terminate_terminal_process` uses sync `std::process::Command` in async |
| 5 | Runtime | Persistence doesn't save `processed_commits` — crash recovery loses idempotency guards |
| 6 | Runtime | Duplicated 50-line spawn+cleanup closure between two methods |
| 7 | Runtime | `running_workflows.insert()` after `tokio::spawn` — race window for fast-failing agents |
| 8 | LLM | ResilientLLMClient `chat()` TOCTOU race — read-lock check then write-lock update |
| 9 | LLM | MockLLMClient too simplistic — can't test failover recovery, malformed responses, timeouts |
| 10 | LLM | Dead code `retry_with_backoff` function could cause 3xN retry amplification if reused |
| 11 | PromptWatcher | Write lock held for entire `process_output()` (~1200 lines) — blocks all other terminals |
| 12 | PromptWatcher | `has_handoff_stall_wait_marker` matches extremely common English phrases |
| 13 | PromptWatcher | `is_notepad_prompt` fallback triggers on any text containing "notepad" + "open"/"use" + "?" |
| 14 | PromptWatcher | `publish_terminal_input` return value ignored — failed delivery silently drops auto-response |
| 15 | Concierge | Notification watcher task never unsubscribes from message bus — leaks indefinitely |
| 16 | Concierge | Runtime tool HTTP calls bypass API authentication — fail with 401 when auth enabled |
| 17 | Concierge | Broadcast channel (256) silently drops messages for slow consumers |
| 18 | Git | No git lock contention handling for concurrent terminals |
| 19 | Git | `--branches` flag misses commits on detached HEAD |
| 20 | Git | `merge_changes` is not atomic — partial failure leaves inconsistent branch state |
| 21 | Container | Orphan workspace cleanup race condition — can delete workspace being created |
| 22 | CC-Switch | Merge coordinator uses `read()` lock for write operation — allows concurrent merges |
| 23 | CC-Switch | Feishu connector `is_connected()` returns stale state — no auto-detection of WS drop |
| 24 | CC-Switch | Approval `entry_index` becomes stale during concurrent conversation mutations |
| 25 | Events | MsgStore broadcast silently drops Lagged events (unlike EventService which resyncs) |

---

## Module Health Summary

### REJECT (requires architectural refactoring)
- **PromptWatcher (54/100)**: Fundamental design flaw — chunk-level newline stripping + combinatorial substring matching. 700+ lines duplicated between chunk/line handlers. Not patchable with more patterns.

### CONDITIONAL PASS (requires P0 fixes before release)
- **Concierge (64.9/100)**: Path traversal vulnerability, stale state bugs, missing auth in internal HTTP calls
- **CC-Switch (66.6/100)**: API key security issues, merge coordinator lock not enforced, RwLock misuse

### PASS WITH CONCERNS (P1 issues should be addressed)
- **Orchestrator Core (76/100)**: Silent message swallowing, recursion trap, race conditions
- **Git Services (79/100)**: Event loss on publish failure is the single most dangerous failure mode
- **Container (79/100)**: Panic risk in `should_finalize`, orphan cleanup race
- **Terminal (79/100)**: Performance bottleneck from prompt_watcher lock contention
- **Runtime (80.75/100)**: Crash recovery loses idempotency, duplicated code
- **Events (80/100)**: MsgStore lag handling inconsistent with EventService
- **LLM (82/100)**: TOCTOU race in ResilientLLMClient, inadequate mock for testing
