# Full-Scale Audit Report — Wave 2 (Server Routes, Quality Gate, Remaining Services)

**Date:** 2026-03-29
**Scope:** Agents 11-20

---

## Executive Summary

| Agent | Zone | Score | Rating | P0 | P1 | P2 | P3 | Total |
|-------|------|-------|--------|----|----|----|----|-------|
| 11 | Remaining Services | — | B | 3 | 5 | 5 | 5 | 18 |
| 12 | **Workflow Routes** | **61** | **C** | **3** | **6** | **6** | **6** | **21** |
| 13 | **Task & Terminal Routes** | **69.65** | **C** | **2** | **4** | **6** | **5** | **17** |
| 14 | Planning Drafts & Models | 72 | B | 1 | 3 | 5 | 5 | 14 |
| 15 | **Projects, Config & Git** | **69** | **C** | **2** | **3** | **5** | **5** | **15** |
| 16 | Concierge/Chat/Feishu Routes | 72 | B | 3 | 5 | 5 | 5 | 18 |
| 17 | Self-Test/MCP/Health | 76 | B | 2 | 4 | 5 | 5 | 16 |
| 18 | **Quality Rules Rust** | **70** | **B** | **3** | **5** | **6** | **5** | **19** |
| 19 | **Quality Rules TS/Common** | **69** | **C** | **3** | **5** | **6** | **4** | **18** |
| 20 | **Quality Gate Engine** | **72** | **B** | **3** | **4** | **5** | **3** | **15** |
| **TOTAL** | | | | **25** | **44** | **54** | **48** | **171** |

**4 modules C rating:** Workflow Routes (61), Task/Terminal Routes (69.65), Projects/Config/Git (69), Quality Rules TS/Common (69)

---

## Wave 2 P0 Critical Issues (25 total)

### Remaining Services (3)
1. Command injection via PowerShell in notification.rs
2. Command injection via osascript in macOS notification
3. DefaultHasher for user ID — not stable across Rust versions

### Workflow Routes (3)
4. **DIY quiet-window monitor doesn't broadcast status events** — UI never updates
5. **DIY monitor ignores all DB errors** via `let _ =`
6. **DIY auto-dispatch blocks HTTP response** with serial 2.5s delays per terminal

### Task & Terminal Routes (2)
7. CLI install/uninstall has no concurrent job guard — race condition
8. Install status endpoints return hardcoded placeholder data ("unknown")

### Planning Drafts (1)
9. **UTF-8 string truncation `&text[..4000]` panics on multi-byte chars** — guaranteed crash with Chinese text

### Projects/Config/Git (2)
10. Hand-rolled HMAC-SHA256 instead of using `hmac` crate
11. CI webhook silently accepts all payloads when secret is unset

### Concierge/Chat/Feishu (3)
12. Same UTF-8 truncation panic as #9 (duplicated code)
13. Replay cache unbounded memory growth — DoS vector
14. `constant_time_eq_chat` leaks length via early return

### Self-Test/MCP/Health (2)
15. `unsafe` env var mutations in async context — UB risk
16. Auth middleware reads env var per-request while tests mutate it concurrently

### Quality Rules Rust (3)
17. **`RuleConfig.enabled` never checked — rules cannot be disabled**
18. **`changed_files` parameter ignored — always scans entire project**
19. Error handling rule hardcodes severity, ignoring config override

### Quality Rules TS/Common (3)
20. **Secret detection has critical coverage gaps** — missing Slack, Google, Stripe, Azure tokens
21. Secret detection has no test fixture exclusion — high false positive rate
22. **Brace counting ignores string/template literals** — corrupts 4/11 TS rules

### Quality Gate Engine (3)
23. **Missing metrics return OK — quality gate passes when checks didn't run**
24. **Provider failures silently swallowed** — `warn!` only, no impact on decision
25. **Branch Gate and Repo Gate are dead code** — never called at runtime
