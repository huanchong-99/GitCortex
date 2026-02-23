# Phase 10 Warning-Free Delivery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate build/test warnings and keep frontend + backend test runs clean (zero warning output).

**Architecture:** Add a default Tailwind config for PostCSS, introduce test-only shims (canvas mock, logging guards), and gate noisy logging in test mode while preserving production behavior.

**Tech Stack:** Vite/Vitest + React + Tailwind CSS + i18next; Rust (Cargo); pnpm.

**Workflow:** @superpowers:test-driven-development per task; execute with @superpowers:executing-plans.

### Task 1: Refresh Browserslist database to clear caniuse-lite warnings

**Files:**
- Modify: `vibe-kanban-main/pnpm-lock.yaml`

**Step 1: Run the warning reproduction check**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- --run`
Expected: WARN about `caniuse-lite` being outdated with an update command hint.

**Step 2: Update the Browserslist DB**

Run (from `vibe-kanban-main`): `pnpm dlx browserslist@latest --update-db`
Expected: Update message + `pnpm-lock.yaml` changes.

**Step 3: Re-run tests to verify warning is gone**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- --run`
Expected: PASS with no Browserslist warning.

**Step 4: Commit**

```bash
git add vibe-kanban-main/pnpm-lock.yaml
git commit -m "chore: update browserslist db"
```

### Task 2: Add default Tailwind config to avoid empty content warnings

**Files:**
- Create: `vibe-kanban-main/frontend/tailwind.config.cjs`
- Modify: `vibe-kanban-main/frontend/postcss.config.cjs`
- Test: `vibe-kanban-main/frontend/src/test/tailwind-config.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';

describe('tailwind default config', () => {
  it('exposes a non-empty content array', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../../tailwind.config.cjs');
    expect(Array.isArray(config.content)).toBe(true);
    expect(config.content.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- tailwind-config.test.ts --run`
Expected: FAIL because `tailwind.config.cjs` is missing (or content is empty).

**Step 3: Write minimal implementation**

Create `tailwind.config.cjs`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

Update `postcss.config.cjs`:
```js
module.exports = {
  plugins: {
    tailwindcss: { config: './tailwind.config.cjs' },
    autoprefixer: {},
  },
};
```

**Step 4: Run test to verify it passes**

Run:
- `pnpm test -- tailwind-config.test.ts --run`
- `pnpm test -- --run`
Expected: PASS with Tailwind content warning removed.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/tailwind.config.cjs \
        vibe-kanban-main/frontend/postcss.config.cjs \
        vibe-kanban-main/frontend/src/test/tailwind-config.test.ts
git commit -m "chore: add default tailwind config for tests"
```

### Task 3: Provide a JSDOM canvas mock to remove getContext warnings

**Files:**
- Modify: `vibe-kanban-main/frontend/src/test/setup.ts`
- Test: `vibe-kanban-main/frontend/src/test/canvas-mock.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';

describe('canvas mock', () => {
  it('does not throw when getContext is called', () => {
    const canvas = document.createElement('canvas');
    expect(() => canvas.getContext('2d')).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- canvas-mock.test.ts --run`
Expected: FAIL with `Not implemented: HTMLCanvasElement.prototype.getContext`.

**Step 3: Write minimal implementation**

Update `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom';

if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = () =>
    ({
      fillRect: () => {},
      clearRect: () => {},
      getImageData: () => ({ data: [] }),
      putImageData: () => {},
      createImageData: () => [],
      setTransform: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      translate: () => {},
      scale: () => {},
      rotate: () => {},
      arc: () => {},
      fill: () => {},
      measureText: () => ({ width: 0 }),
      transform: () => {},
      rect: () => {},
      clip: () => {},
    }) as unknown as CanvasRenderingContext2D;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- canvas-mock.test.ts --run`
Expected: PASS, no canvas warnings.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/test/setup.ts \
        vibe-kanban-main/frontend/src/test/canvas-mock.test.ts
git commit -m "test: add jsdom canvas mock"
```

### Task 4: Disable i18n debug logging in test mode

**Files:**
- Modify: `vibe-kanban-main/frontend/src/i18n/config.ts`
- Test: `vibe-kanban-main/frontend/src/i18n/__tests__/config.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';

describe('i18n config', () => {
  it('does not log debug output in tests', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('../config');
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- config.test.ts --run`
Expected: FAIL because debug logs are emitted.

**Step 3: Write minimal implementation**

Update `src/i18n/config.ts`:
```ts
const isTestEnv = import.meta.env.MODE === 'test' || import.meta.env.VITEST;
const isDev = import.meta.env.DEV && !isTestEnv;

i18n.init({
  // ...
  debug: isDev,
});

if (isDev) {
  console.log('i18n initialized:', i18n.isInitialized);
  // ...
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- config.test.ts --run`
Expected: PASS with no i18n debug logs.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/i18n/config.ts \
        vibe-kanban-main/frontend/src/i18n/__tests__/config.test.ts
git commit -m "test: silence i18n debug logs in tests"
```

### Task 5: Gate API error logging during tests

**Files:**
- Modify: `vibe-kanban-main/frontend/src/lib/api.ts`
- Test: `vibe-kanban-main/frontend/src/lib/__tests__/api-logging.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest';
import { logApiError } from '../api';

describe('api logging', () => {
  it('does not emit console.error in tests', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logApiError('Test error', { status: 500 });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- api-logging.test.ts --run`
Expected: FAIL because console.error is called.

**Step 3: Write minimal implementation**

Add a helper in `src/lib/api.ts`:
```ts
const isTestEnv = import.meta.env.MODE === 'test' || import.meta.env.VITEST;

export const logApiError = (...args: unknown[]) => {
  if (isTestEnv) return;
  console.error(...args);
};
```
Replace existing `console.error(...)` calls with `logApiError(...)`.

**Step 4: Run test to verify it passes**

Run: `pnpm test -- api-logging.test.ts --run`
Expected: PASS with no API error logs in tests.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/lib/api.ts \
        vibe-kanban-main/frontend/src/lib/__tests__/api-logging.test.ts
git commit -m "test: gate api error logging in tests"
```

### Task 6: Remove React act(...) warnings in Step4Terminals/Step5Commands tests

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.test.tsx`

**Step 1: Write the failing test**

Add an assertion in one existing test per file to ensure no act warnings:

```ts
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
// render component
expect(errorSpy).not.toHaveBeenCalled();
errorSpy.mockRestore();
```

Expected: FAIL (act warning emitted).

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`):
- `pnpm test -- Step4Terminals.test.tsx --run`
- `pnpm test -- Step5Commands.test.tsx --run`
Expected: FAIL with act(...) warning on console.error.

**Step 3: Update tests to await async updates**

Add `await setTestLanguage()` in `beforeEach`, and replace synchronous assertions with `await screen.findByText(...)` or `await waitFor(...)` so all state updates are wrapped in RTL `act`.

**Step 4: Run tests to verify they pass without warnings**

Run:
- `pnpm test -- Step4Terminals.test.tsx --run`
- `pnpm test -- Step5Commands.test.tsx --run`
Expected: PASS, no act warnings.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step4Terminals.test.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step5Commands.test.tsx
git commit -m "test: wrap Step4/5 async updates to avoid act warnings"
```

### Task 7: Opt-in React Router future flags in WorkflowDebug tests

**Files:**
- Modify: `vibe-kanban-main/frontend/src/pages/WorkflowDebug.test.tsx`

**Step 1: Write the failing test**

Add a console.warn spy in the loading test:

```ts
const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
render(<WorkflowDebugPage />, { wrapper });
expect(warnSpy).not.toHaveBeenCalled();
warnSpy.mockRestore();
```

Expected: FAIL due to React Router future flag warnings.

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- WorkflowDebug.test.tsx --run`
Expected: FAIL with future flag warnings.

**Step 3: Enable future flags**

Update `BrowserRouter` to pass:
```ts
future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
```

**Step 4: Run test to verify it passes without warnings**

Run: `pnpm test -- WorkflowDebug.test.tsx --run`
Expected: PASS, no future flag warnings.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/pages/WorkflowDebug.test.tsx
git commit -m "test: opt into react-router v7 future flags"
```

### Task 8: Add DialogDescription to Step3Models dialog

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.test.tsx`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json`
- Modify: `vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json`

**Step 1: Write the failing test**

Add a test that asserts no dialog warning is logged:

```ts
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
// open dialog
expect(errorSpy).not.toHaveBeenCalled();
errorSpy.mockRestore();
```

Expected: FAIL with Radix Dialog missing description warning.

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- Step3Models.test.tsx --run`
Expected: FAIL with missing description warning.

**Step 3: Add DialogDescription**

Import `DialogDescription` and render a `DialogDescription` (sr-only is fine) with a new `step3.dialog.description` translation key.

**Step 4: Run test to verify it passes without warnings**

Run: `pnpm test -- Step3Models.test.tsx --run`
Expected: PASS, no dialog warning.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.tsx \
        vibe-kanban-main/frontend/src/components/workflow/steps/Step3Models.test.tsx \
        vibe-kanban-main/frontend/src/i18n/locales/en/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/es/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/ja/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/ko/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/zh-Hans/workflow.json \
        vibe-kanban-main/frontend/src/i18n/locales/zh-Hant/workflow.json
git commit -m "feat: add dialog description for model form"
```

### Task 9: Silence useWorkflows error logging in tests

**Files:**
- Modify: `vibe-kanban-main/frontend/src/hooks/useWorkflows.ts`
- Modify: `vibe-kanban-main/frontend/src/hooks/useWorkflows.test.tsx`

**Step 1: Write the failing test**

In the error test, spy on console.error:

```ts
const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
// trigger mutation error
expect(errorSpy).not.toHaveBeenCalled();
errorSpy.mockRestore();
```

Expected: FAIL (console.error called).

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- useWorkflows.test.tsx --run`
Expected: FAIL due to console.error.

**Step 3: Replace console.error with logApiError**

Import `logApiError` from `@/lib/api` and use it in mutation `onError` handlers.

**Step 4: Run test to verify it passes without warnings**

Run: `pnpm test -- useWorkflows.test.tsx --run`
Expected: PASS, no console.error output.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/hooks/useWorkflows.ts \
        vibe-kanban-main/frontend/src/hooks/useWorkflows.test.tsx
git commit -m "test: gate workflow mutation error logs"
```

### Task 10: Suppress TerminalEmulator console.log output in tests

**Files:**
- Modify: `vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.tsx`
- Modify: `vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.test.tsx`

**Step 1: Write the failing test**

Update the WebSocket test to assert no console.log is called:

```ts
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
render(<TerminalEmulator terminalId={VALID_TERMINAL_ID} wsUrl="ws://localhost:8080" />);
expect(logSpy).not.toHaveBeenCalled();
logSpy.mockRestore();
```

Expected: FAIL (console.log called).

**Step 2: Run test to verify it fails**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- TerminalEmulator.test.tsx --run`
Expected: FAIL due to console.log calls.

**Step 3: Gate logs in test mode**

Add a small `logInfo` helper in `TerminalEmulator` or shared util that no-ops when `import.meta.env.MODE === 'test' || import.meta.env.VITEST`.

**Step 4: Run test to verify it passes without logs**

Run: `pnpm test -- TerminalEmulator.test.tsx --run`
Expected: PASS, no console.log output.

**Step 5: Commit**

```bash
git add vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.tsx \
        vibe-kanban-main/frontend/src/components/terminal/TerminalEmulator.test.tsx
git commit -m "test: silence terminal websocket logs in tests"
```

### Task 11: Remove build-time warning for dummy frontend/dist

**Files:**
- Modify: `vibe-kanban-main/crates/server/build.rs`

**Step 1: Reproduce the warning**

Run (from `vibe-kanban-main`): `cargo test --workspace --no-fail-fast`
Expected: WARN about creating dummy frontend/dist directory.

**Step 2: Remove the cargo warning**

Delete the `println!("cargo:warning=...")` line while keeping the directory creation.

**Step 3: Re-run tests to verify warning is gone**

Run: `cargo test --workspace --no-fail-fast`
Expected: PASS, no build warnings.

**Step 4: Commit**

```bash
git add vibe-kanban-main/crates/server/build.rs
git commit -m "chore: silence frontend dist build warning"
```

### Task 12: Final verification (zero warnings)

**Files:**
- None (verification only)

**Step 1: Run frontend tests**

Run (from `vibe-kanban-main/frontend`): `pnpm test -- --run`
Expected: PASS, zero warnings.

**Step 2: Run backend tests**

Run (from `vibe-kanban-main`): `cargo test --workspace --no-fail-fast`
Expected: PASS, zero warnings.

**Step 3: Commit**

No new changes; ensure working tree is clean.

---

Plan complete and saved to `docs/developed/plans/2026-01-20-phase-10-warning-free.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
