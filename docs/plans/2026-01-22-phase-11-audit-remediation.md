# Phase 11: Audit Remediation - Remote Feature Alignment

Date: 2026-01-22
Source: Audit report (remote features removed but UI/types still present)
Status: Completed
Completed: 2026-01-21

## Goals
- Prevent broken share/remote project flows when backend features are disabled.
- Align generated shared types with the actual backend surface.
- Eliminate background shared-task sync when remote is disabled.

## Scope
- Backend: expose a remote feature flag/capability for gating.
- Frontend: gate or remove share/link UI and API calls based on the flag.
- Types: update `generate_types` output and regenerate `shared/types.ts`.

## Tasks
### 11.8 Backend capability flag
- Add `remote_features_enabled` (or similar) to config/environment returned by `/api/config`.
- Ensure remote endpoints return a consistent error when disabled.

### 11.9 Frontend gating and cleanup
- Hide/disable ShareDialog, LinkProjectDialog, and shared-task actions when the flag is false.
- Remove or guard `sharedTasksCollection` and related hooks to avoid background sync.

### 11.10 Type generation alignment
- Update `crates/server/src/bin/generate_types.rs` to match the supported API surface.
- Regenerate `shared/types.ts` and fix TS imports/usages.
- Verify `npm run generate-types:check` passes.

## Acceptance Criteria
- No user-facing flow triggers `/api/tasks/:id/share` or `/api/projects/:id/remote/*` when remote features are disabled.
- `rg "shared_tasks|share_task|remote_project"` only matches explicitly gated code paths.
- `npm run generate-types:check` succeeds with a clean diff.

## Out of Scope
- Reintroducing remote sharing or remote project services.
