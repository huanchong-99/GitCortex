# Phase 9 S-Tier Quality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish Phase 9 quality upgrades (frontend i18n + error handling, JS/Rust docs, strict linting) and restore clean test/lint baselines.

**Architecture:** Workflow/terminal UI uses i18n keys under the `workflow` namespace; errors propagate via `onError` + `useErrorNotification`; shared WS message types come from `shared/types`; backend orchestrator gets inline docs and strict lint configs (ESLint strict + Clippy pedantic).

**Tech Stack:** React + TypeScript + Vitest + i18next; Rust + Cargo + Clippy; SQLite migrations.

### Task 0: Audit existing Phase 9 changes and baseline failures

**Files:**
- Modify: `docs/plans/2026-01-19-phase-9-s-tier-quality.md` (update notes if needed)

**Step 1: Review current branch changes**
Run (from repo root): `git status -sb`
Expected: Identify which Phase 9 files already changed.

**Step 2: Verify Phase 9 task coverage**
Run: `rg -n "idx_workflow_project_created|RateLimiter|temp_env" vibe-kanban-main`
Expected: Confirm P1/P2 items already present in code.

**Step 3: Decide reuse vs rewrite**
Document whether existing changes match Phase 9 requirements and keep them if quality is acceptable.

### Task 1: Enforce UUID terminalId validation in TerminalEmulator

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.tsx`
- Test: `vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.test.tsx`

**Step 1: Write the failing test**
```tsx
it('accepts valid UUID terminalId', () => {
  const onError = vi.fn();
  render(
    <TerminalEmulator
      terminalId="123e4567-e89b-12d3-a456-426614174000"
      onError={onError}
    />
  );
  expect(onError).not.toHaveBeenCalled();
});

it('rejects non-UUID terminalId', () => {
  const onError = vi.fn();
  render(<TerminalEmulator terminalId="test-terminal-1" onError={onError} />);
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('terminalId') })
  );
});
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- TerminalEmulator.test.tsx --run`
Expected: FAIL because the current regex still accepts non-UUID IDs.

**Step 3: Write minimal implementation**
```tsx
const TERMINAL_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

if (!terminalId || !TERMINAL_ID_REGEX.test(terminalId)) {
  notifyError('Invalid terminalId (expected UUID)');
  return;
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- TerminalEmulator.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.tsx \
        vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.test.tsx
git commit -m "feat: enforce UUID terminalId validation"
```

### Task 2: Harden WebSocket message type guards

**Files:**
- Modify: `vibe-kanban-main/frontend/src/types/__tests__/websocket.test.ts`
- Modify (if needed): `vibe-kanban-main/frontend/src/types/websocket.ts`

**Step 1: Write the failing test**
```ts
it('rejects output messages with non-string data', () => {
  const msg = { type: 'output', data: 123 };
  expect(isWsOutputMessage(msg)).toBe(false);
});

it('rejects error messages with non-string message', () => {
  const msg = { type: 'error', message: 123 };
  expect(isWsErrorMessage(msg)).toBe(false);
});
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- websocket.test.ts --run`
Expected: FAIL if guards are too permissive.

**Step 3: Write minimal implementation (if needed)**
```ts
export function isWsOutputMessage(msg: unknown): msg is WsOutputMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as WsMessage).type === 'output' &&
    'data' in msg &&
    typeof (msg as WsOutputMessage).data === 'string'
  );
}

export function isWsErrorMessage(msg: unknown): msg is WsErrorMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as WsMessage).type === 'error' &&
    'message' in msg &&
    typeof (msg as WsErrorMessage).message === 'string'
  );
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- websocket.test.ts --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/types/websocket.ts \
        vibe-kanban-main/frontend/src/types/__tests__/websocket.test.ts
git commit -m "test: harden websocket type guard coverage"
```

### Task 3: Replace Step0Project console.error with error notifications

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step0Project.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step0Project.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.tsx`

**Step 1: Write the failing test**
```tsx
it('calls onError when git status fetch fails', async () => {
  const onError = vi.fn();
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom'));

  renderWithI18n(
    <Step0Project config={defaultConfig} onChange={mockOnChange} errors={{}} onError={onError} />
  );

  fireEvent.change(screen.getByRole('textbox'), { target: { value: '/path' } });

  await waitFor(() => {
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- Step0Project.test.tsx --run`
Expected: FAIL because Step0Project does not accept `onError` yet.

**Step 3: Write minimal implementation**
```tsx
interface Step0ProjectProps {
  config: ProjectConfig;
  onChange: (updates: Partial<ProjectConfig>) => void;
  errors: Record<string, string>;
  onError?: (error: Error) => void;
}

const { notifyError } = useErrorNotification({ onError, context: 'Step0Project' });

// replace console.error
} catch (error) {
  notifyError(error, 'checkGitStatus');
  setApiError(t('step0.errors.gitNetwork'));
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- Step0Project.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step0Project.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step0Project.test.tsx \
        vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.tsx
git commit -m "feat: notify Step0Project errors via onError"
```

### Task 4: Replace Step4Terminals console.error with error notifications

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.tsx`

**Step 1: Write the failing test**
```tsx
it('calls onError when CLI detection fails', async () => {
  const onError = vi.fn();
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

  renderWithI18n(
    <Step4Terminals config={config} errors={{}} onUpdate={mockOnUpdate} onError={onError} />
  );

  await waitFor(() => {
    expect(onError).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- Step4Terminals.test.tsx --run`
Expected: FAIL because Step4Terminals does not accept `onError` yet.

**Step 3: Write minimal implementation**
```tsx
interface Step4TerminalsProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
  onError?: (error: Error) => void;
}

const { notifyError } = useErrorNotification({ onError, context: 'Step4Terminals' });

} catch (error) {
  notifyError(error, 'detectCliTypes');
} finally {
  setIsDetecting(false);
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- Step4Terminals.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.test.tsx \
        vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.tsx
git commit -m "feat: notify Step4Terminals errors via onError"
```

### Task 5: Replace Step5Commands console.error with error notifications

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.tsx`

**Step 1: Write the failing test**
```tsx
it('calls onError when presets fetch fails', async () => {
  const onError = vi.fn();
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));

  renderWithI18n(
    <Step5Commands config={defaultConfig} errors={{}} onUpdate={mockOnUpdate} onError={onError} />
  );

  await waitFor(() => {
    expect(onError).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- Step5Commands.test.tsx --run`
Expected: FAIL because Step5Commands does not accept `onError` yet.

**Step 3: Write minimal implementation**
```tsx
interface Step5CommandsProps {
  config: CommandConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<CommandConfig>) => void;
  onError?: (error: Error) => void;
}

const { notifyError } = useErrorNotification({ onError, context: 'Step5Commands' });

} catch (error) {
  notifyError(error, 'fetchUserPresets');
} finally {
  setIsLoading(false);
}
```

**Step 4: Run test to verify it passes**
Run: `pnpm test -- Step5Commands.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.test.tsx \
        vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.tsx
git commit -m "feat: notify Step5Commands errors via onError"
```

### Task 6: i18n Step3Models

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json`

**Step 1: Write the failing test**
```tsx
renderWithI18n(
  <Step3Models config={defaultConfig} onUpdate={mockOnUpdate} errors={{}} />
);
expect(screen.getByText(i18n.t('workflow:step3.header'))).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- Step3Models.test.tsx --run`
Expected: FAIL because Step3Models still renders hard-coded strings.

**Step 3: Write minimal implementation**
```tsx
const { t } = useTranslation('workflow');

<h2>{t('step3.header')}</h2>
<button>{t('step3.addModel')}</button>
<FieldLabel>{t('step3.displayNameLabel')}</FieldLabel>
```
Add translation keys under `step3.*` (headers, buttons, labels, placeholders, errors, dialog title, etc.).

**Step 4: Run test to verify it passes**
Run: `pnpm test -- Step3Models.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.test.tsx \
        vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json
git commit -m "feat: i18n Step3Models"
```

### Task 7: i18n Step4Terminals

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json`

**Step 1: Write the failing test**
```tsx
renderWithI18n(
  <Step4Terminals config={config} errors={{}} onUpdate={mockOnUpdate} />
);
expect(screen.getByText(i18n.t('workflow:step4.header'))).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- Step4Terminals.test.tsx --run`
Expected: FAIL due to hard-coded strings.

**Step 3: Write minimal implementation**
```tsx
const { t } = useTranslation('workflow');

<h2>{t('step4.header')}</h2>
<span>{t('step4.taskCounter', { current: currentTaskIndex + 1, total: config.tasks.length })}</span>
<FieldLabel>{t('step4.cliTypeLabel')}</FieldLabel>
```
Add translation keys under `step4.*` for headers, navigation, labels, empty text, status, and role placeholder.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- Step4Terminals.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.test.tsx \
        vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json
git commit -m "feat: i18n Step4Terminals"
```

### Task 8: i18n Step5Commands

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json`

**Step 1: Write the failing test**
```tsx
renderWithI18n(
  <Step5Commands config={defaultConfig} errors={{}} onUpdate={mockOnUpdate} />
);
expect(screen.getByText(i18n.t('workflow:step5.header'))).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- Step5Commands.test.tsx --run`
Expected: FAIL due to hard-coded strings.

**Step 3: Write minimal implementation**
```tsx
const { t } = useTranslation('workflow');

const SYSTEM_PRESETS = [
  {
    id: 'write-code',
    nameKey: 'step5.systemPresets.writeCode.name',
    descriptionKey: 'step5.systemPresets.writeCode.description',
    isSystem: true,
  },
  // ...
];

<div>{t('step5.header')}</div>
<span>{t('step5.enabledLabel')}</span>
```
Add translation keys under `step5.*` for headers, radio labels, action buttons, list labels, and preset display/description text.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- Step5Commands.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.test.tsx \
        vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json
git commit -m "feat: i18n Step5Commands"
```

### Task 9: i18n Step6Advanced

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step6Advanced.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step6Advanced.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json`

**Step 1: Write the failing test**
```tsx
renderWithI18n(
  <Step6Advanced config={config} errors={{}} onUpdate={mockOnUpdate} />
);
expect(screen.getByText(i18n.t('workflow:step6.header'))).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**
Run: `pnpm test -- Step6Advanced.test.tsx --run`
Expected: FAIL due to hard-coded strings.

**Step 3: Write minimal implementation**
```tsx
const { t } = useTranslation('workflow');

<h2>{t('step6.header')}</h2>
<FieldLabel>{t('step6.targetBranchLabel')}</FieldLabel>
```
Add translation keys under `step6.*` for headers, labels, toggles, hints, and button text.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- Step6Advanced.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step6Advanced.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step6Advanced.test.tsx \
        vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json
git commit -m "feat: i18n Step6Advanced"
```

### Task 10: i18n WorkflowWizard UI + tests

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/test/renderWithI18n.tsx` (if test helpers need tweaks)

**Step 1: Write the failing test**
```tsx
renderWithI18n(<WorkflowWizard onComplete={vi.fn()} onCancel={vi.fn()} />);
expect(screen.getByText(i18n.t('workflow:wizard.title'))).toBeInTheDocument();
expect(screen.getByText(i18n.t('workflow:wizard.buttons.cancel'))).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- WorkflowWizard.test.tsx --run`
Expected: FAIL because tests still assert hard-coded strings.

**Step 3: Write minimal implementation**
Update tests to use `renderWithI18n` and `i18n.t('workflow:...')` for all string assertions.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- WorkflowWizard.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.test.tsx \
        vibe-kanban-main/frontend/src/test/renderWithI18n.tsx
git commit -m "test: i18n WorkflowWizard expectations"
```

### Task 11: i18n PipelineView, TerminalCard, TerminalDebugView, WorkflowDebug

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/PipelineView.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/TerminalCard.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/terminal/TerminalDebugView.tsx`
- Modify: `vibe-kanban-main/frontend/src/pages/WorkflowDebug.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/terminal/TerminalDebugView.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/pages/WorkflowDebug.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/constants.ts`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json`

**Step 1: Write the failing test**
```tsx
renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost" />);
expect(screen.getByText(i18n.t('workflow:terminalDebug.sidebarTitle'))).toBeInTheDocument();
```

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`):
`pnpm test -- TerminalDebugView.test.tsx WorkflowDebug.test.tsx --run`
Expected: FAIL due to hard-coded strings.

**Step 3: Write minimal implementation**
```tsx
const { t } = useTranslation('workflow');

<span>{t('pipeline.taskLabel', { index: taskIndex + 1 })}</span>
<span>{t(`pipeline.status.${status}`)}</span>

<div>{terminal.role || t('terminal.defaultRole', { index: terminal.orderIndex + 1 })}</div>
```
Add translation keys under `pipeline.*`, `terminal.*`, and `workflowDebug.*` for status labels, headers, tabs, and button text.

**Step 4: Run test to verify it passes**
Run: `pnpm test -- TerminalDebugView.test.tsx WorkflowDebug.test.tsx --run`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow/PipelineView.tsx \
        vibe-kanban-main/frontend/src/components/workflow/TerminalCard.tsx \
        vibe-kanban-main/frontend/src/components/terminal/TerminalDebugView.tsx \
        vibe-kanban-main/frontend/src/pages/WorkflowDebug.tsx \
        vibe-kanban-main/frontend/src/components/terminal/TerminalDebugView.test.tsx \
        vibe-kanban-main/frontend/src/pages/WorkflowDebug.test.tsx \
        vibe-kanban-main/frontend/src/components/workflow/constants.ts \
        vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json
git commit -m "feat: i18n workflow debug and pipeline UI"
```

### Task 12: Add JSDoc to exported workflow/terminal components and hooks

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/WorkflowWizard.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/StepIndicator.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/PipelineView.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/TerminalCard.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step0Project.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step1Basic.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step2Tasks.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step6Advanced.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/terminal/TerminalDebugView.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/hooks/useWizardNavigation.ts`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/hooks/useWizardValidation.ts`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/validators/index.ts`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/validators/step*.ts`
- Modify: `vibe-kanban-main/frontend/src/hooks/useErrorNotification.ts`

**Step 1: Write the failing test**
No test change required; this is a doc-only task.

**Step 2: Run test to verify it fails**
Skip.

**Step 3: Write minimal implementation**
Add JSDoc blocks to each exported component/hook/validator.
Example:
```ts
/**
 * Renders the workflow wizard container and handles navigation/validation.
 */
export function WorkflowWizard(...) { ... }
```

**Step 4: Run test to verify it passes**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- Step0Project.test.tsx --run`
Expected: PASS (spot-check only)

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/src/components/workflow \
        vibe-kanban-main/frontend/src/components/terminal \
        vibe-kanban-main/frontend/src/components/workflow/validators \
        vibe-kanban-main/frontend/src/hooks/useErrorNotification.ts
git commit -m "docs: add JSDoc to workflow and terminal exports"
```

### Task 13: Add Rust inline docs for orchestrator core

**Files:**
- Modify: `vibe-kanban-main/crates/services/src/services/orchestrator/agent.rs`
- Modify: `vibe-kanban-main/crates/services/src/services/orchestrator/llm.rs`
- Modify: `vibe-kanban-main/crates/services/src/services/orchestrator/message_bus.rs`
- Modify: `vibe-kanban-main/crates/services/src/services/orchestrator/state.rs`

**Step 1: Write the failing test**
No test change required; this is a doc-only task.

**Step 2: Run test to verify it fails**
Skip.

**Step 3: Write minimal implementation**
Add module-level and key struct/function docs.
Example:
```rust
/// OrchestratorAgent coordinates workflow execution and routes terminal events.
pub struct OrchestratorAgent { ... }

/// Broadcasts events to active subscribers in a fan-out pattern.
pub struct MessageBus { ... }
```

**Step 4: Run test to verify it passes**
Run (from `vibe-kanban-main`): `cargo test -p services --lib orchestrator::tests::`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/crates/services/src/services/orchestrator
git commit -m "docs: add orchestrator inline documentation"
```

### Task 14: Add ESLint strict configuration and fix violations

**Files:**
- Create: `vibe-kanban-main/frontend/.eslintrc.strict.cjs`
- Modify: `vibe-kanban-main/frontend/package.json`
- Modify: any TS/TSX files flagged by strict lint

**Step 1: Write the failing test**
Add `lint:strict` script and run it to capture failures.

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main/frontend`): `pnpm lint:strict`
Expected: FAIL with strict-rule violations.

**Step 3: Write minimal implementation**
Create strict config:
```js
const base = require('./.eslintrc.cjs');

module.exports = {
  ...base,
  extends: [
    ...base.extends,
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
  ],
};
```
Add script:
```json
"lint:strict": "eslint -c .eslintrc.strict.cjs . --ext ts,tsx --max-warnings 0"
```
Fix violations until `pnpm lint:strict` is clean.

**Step 4: Run test to verify it passes**
Run: `pnpm lint:strict`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/frontend/.eslintrc.strict.cjs \
        vibe-kanban-main/frontend/package.json \
        vibe-kanban-main/frontend/src
git commit -m "chore: add eslint strict config and fixes"
```

### Task 15: Enable Clippy pedantic and fix warnings

**Files:**
- Create: `vibe-kanban-main/clippy.toml`
- Modify: crate roots (e.g. `crates/*/src/lib.rs`, `crates/server/src/main.rs`)
- Modify: any Rust files flagged by pedantic lint

**Step 1: Write the failing test**
Add pedantic warnings and run clippy to see failures.

**Step 2: Run test to verify it fails**
Run (from `vibe-kanban-main`): `cargo clippy --workspace --all-targets -- -D warnings`
Expected: FAIL until pedantic warnings are addressed.

**Step 3: Write minimal implementation**
Add `clippy.toml` (allow common pedantic noise):
```toml
msrv = "1.75.0"
allow = [
  "doc_markdown",
  "module_name_repetitions",
  "must_use_candidate",
  "missing_errors_doc",
  "missing_panics_doc",
  "similar_names",
  "too_many_lines",
]
```
Add crate-level attribute:
```rust
#![warn(clippy::pedantic)]
```
Fix remaining warnings until clippy is clean.

**Step 4: Run test to verify it passes**
Run: `cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS

**Step 5: Commit**
```bash
git add vibe-kanban-main/clippy.toml \
        vibe-kanban-main/crates
git commit -m "chore: enable clippy pedantic"
```

### Task 16: Final verification for Phase 9

**Files:**
- None (verification only)

**Step 1: Run frontend tests**
Run (from `vibe-kanban-main/frontend`): `pnpm test -- --run`
Expected: PASS

**Step 2: Run frontend strict lint**
Run: `pnpm lint:strict`
Expected: PASS

**Step 3: Run Rust tests**
Run (from `vibe-kanban-main`): `cargo test --workspace --no-fail-fast`
Expected: PASS

**Step 4: Run clippy pedantic**
Run: `cargo clippy --workspace --all-targets -- -D warnings`
Expected: PASS

**Step 5: Commit**
No new changes; ensure working tree is clean.

---

Plan complete and saved to `docs/plans/2026-01-19-phase-9-s-tier-quality.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
