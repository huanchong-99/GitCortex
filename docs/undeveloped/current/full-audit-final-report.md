# GitCortex / SoloDawn — Full-Scale Audit Final Report

**Date:** 2026-03-29
**Scope:** 40 audit agents, 210,000+ lines of code (128K Rust + 83K TypeScript)
**Duration:** 4 waves of parallel execution

---

## Grand Summary

| Wave | Agents | P0 | P1 | P2 | P3 | Total |
|------|--------|----|----|----|----|-------|
| Wave 1 (Core Backend) | 1-10 | 16 | 40 | 59 | 48 | 163 |
| Wave 2 (Routes/Quality) | 11-20 | 25 | 44 | 54 | 48 | 171 |
| Wave 3 (Executors/DB/Frontend) | 21-30 | 12 | 27 | 38 | 37 | 114 |
| Wave 4 (Hooks/Stores/Infra) | 31-40 | 5 | 27 | 34 | 33 | 99 |
| **TOTAL** | **40** | **58** | **138** | **185** | **166** | **547** |

### Module Ratings

| Rating | Count | Modules |
|--------|-------|---------|
| **C (REJECT/Conditional)** | **8** | PromptWatcher (54), Workflow Routes (61), Concierge Agent (64.9), CC-Switch (66.6), Task/Terminal Routes (69.65), Projects/Config/Git (69), Quality Rules TS (69), Quality Rules Rust (70) |
| **B (Conditional Pass)** | **32** | All others (70-82 range) |
| **A (Clean Pass)** | **0** | None |

---

## Top 20 Most Critical Issues (P0)

### Architecture-Level Failures
1. **Quality gate passes when checks didn't run** — Missing metrics return OK (Agent 20)
2. **Provider failures silently swallowed** — `warn!` only, gate still passes (Agent 20)
3. **Branch Gate and Repo Gate are dead code** — Never called at runtime (Agent 20)
4. **DIY quiet-window monitor doesn't broadcast status events** — Frontend never updates (Agent 12)
5. **Git event loss silently swallowed** — Workflow hangs forever with no recovery (Agent 7)

### Security Vulnerabilities
6. **PowerShell command injection in browser.rs** — URL not escaped (Agent 26)
7. **Unsanitized repo_path passed to git init** — LLM path traversal (Agent 6)
8. **API keys written to disk without cleanup** — Persist indefinitely (Agent 9)
9. **API key prefix logged in plaintext** — First 4 chars exposed (Agent 9)
10. **Hand-rolled HMAC-SHA256** — Should use `hmac` crate (Agent 15)
11. **CI webhook accepts all payloads when secret unset** — No production guard (Agent 15)
12. **Command injection via PowerShell/osascript in notifications** (Agent 11)

### Data Integrity / Crashes
13. **UTF-8 string truncation `&text[..4000]` panics on multi-byte chars** — Guaranteed crash with Chinese text (Agents 14, 16)
14. **`should_finalize` panics on invalid executor_action JSON** — Server crash (Agent 8)
15. **Merge coordinator lock not enforced internally** — Concurrent merges corrupt git (Agent 9)

### Silent Failures
16. **PromptWatcher strips newlines causing cross-line false positives** — Root cause of V1 issues (Agent 4)
17. **`handle_message` silently swallows 8 message types via `_ => {}`** (Agent 1)
18. **`RuleConfig.enabled` never checked — rules cannot be disabled** (Agent 18)
19. **Secret detection has critical coverage gaps** — Missing Slack, Google, Stripe tokens (Agent 19)
20. **Brace counting ignores string/template literals** — Corrupts 4/11 TS quality rules (Agent 19)

### Frontend
- **Rules of Hooks violation** — `useWorkspaceContext()` inside try-catch (Agent 28)
- **8 presentational components violate purity rules** — useState/useEffect/Zustand in primitives (Agent 29)
- **ReviewProvider function references unstable** — Re-render storm (Agent 37)
- **No cross-step validation on wizard submit** — FK constraint root cause (Agent 27)
- **shared/types.ts type generation drift** — Rust↔TypeScript contract broken (Agent 39)

---

## Systemic Patterns Identified

### Pattern 1: Silent Error Swallowing (23 instances across codebase)
- Backend: `let _ = ...` on critical DB operations, `.ok()` on publish failures, `.unwrap_or_default()` on query results
- Frontend: `catch { console.error(...) }` with no user feedback, mutation errors silently dropped
- Quality gate: Provider failures logged but not reflected in gate decision

### Pattern 2: DRY Violations (15+ instances)
- Encryption logic copy-pasted 6 times across DB models
- PromptWatcher chunk/line handlers duplicated (700+ lines)
- Workflow status mutation hooks share 90% identical code
- WebSocket boilerplate repeated 4 times in server routes
- `mapTerminalStatus` defined 3 times in frontend

### Pattern 3: i18n Gaps (50+ hardcoded strings)
- `ConciergeChatView.tsx` — 15+ hardcoded Chinese/English strings
- `PendingApprovalEntry.tsx` — 7 hardcoded English strings
- `OrganizationSettingsNew.tsx` — 12+ hardcoded strings
- 4/6 languages missing 60-145 translation keys each
- `slashCommands` namespace referenced but JSON files don't exist

### Pattern 4: Dead Code (12+ instances)
- Branch Gate / Repo Gate — designed but never invoked
- `DevBanner` component — returns null
- `WorkflowDebug.tsx` page — replaced by `WorkflowDebugPage.tsx`
- `FullAttemptLogs.tsx` page — not routed
- Organization routes — all 13 return stub errors
- `retry_with_backoff` function — unused
- FST index — built but never queried
- `TerminalActivityPanel.lastActivity` — always null

### Pattern 5: Configuration Theater (quality gate)
- `RuleConfig.enabled` field exists but is never checked
- `changed_files` parameter accepted but ignored by all 9 providers
- `quality_gate_mode` is a free-form string with no validation
- CI quality gate job uses `continue-on-error: true` — always green

---

## Repair Priority Matrix

### Immediate (Before V1 Release) — 15 issues
1. UTF-8 truncation panic (2 locations)
2. DIY monitor broadcast missing
3. Quality gate silent pass on missing metrics
4. PowerShell command injection in browser.rs
5. Unsanitized repo_path in concierge git init
6. Merge coordinator internal lock enforcement
7. `should_finalize` unwrap panic
8. PromptWatcher newline stripping
9. Git event loss on publish failure
10. Wizard cross-step validation
11. shared/types.ts regeneration
12. ReviewProvider function stability
13. Rules of Hooks violation
14. CI webhook secret enforcement
15. DIY monitor error handling

### High Priority (Next Sprint) — 25 issues
- API key disk cleanup
- Encryption logic deduplication (6→1)
- PromptWatcher chunk/line handler refactor
- Branch/Repo Gate implementation or removal
- Quality rule `enabled` field enforcement
- Secret detection pattern expansion
- i18n sweep (50+ hardcoded strings)
- Dead code removal (12+ files/functions)
- Query key unification (frontend)
- `useQualityGate` raw fetch → makeRequest

### Medium Priority (Backlog) — 50+ issues
- DRY refactoring across codebase
- Remaining i18n translation completion (4 languages)
- Test coverage gaps
- Performance optimizations
- Code style consistency
