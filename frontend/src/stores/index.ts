/**
 * Zustand Stores Index
 *
 * Central export for all application state management stores.
 * These stores follow the design specification for Phase 18.5.
 */

// WebSocket connection management
export { useWsStore, useWsSubscription } from './wsStore';
export type { WsMessage, WsEventType } from './wsStore';

// Workflow state management
export {
  useWorkflowStore,
  useWorkflowList,
  useActiveWorkflow,
} from './workflowStore';

// Terminal state management
export {
  useTerminalStore,
  useTerminalOutputString,
  useActiveTerminal,
  useRecentTerminalOutput,
} from './terminalStore';
export type { TerminalState } from './terminalStore';

// Wizard state management
export {
  useWizardStore,
  useCurrentStepConfig,
  useWizardDirty,
} from './wizardStore';

// Model configuration management
export {
  useModelStore,
  useModelList,
  useVerifiedModels,
  useAvailableModels,
} from './modelStore';

// Existing UI stores (preserved)
export { useUiPreferencesStore } from './useUiPreferencesStore';
export { useDiffViewStore } from './useDiffViewStore';
export { useExpandable } from './useExpandableStore';
export { useTaskStopping } from './useTaskDetailsUiStore';
