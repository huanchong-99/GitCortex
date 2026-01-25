import type { WizardConfig } from '../types';

/**
 * Validates orchestrator and merge settings for step 6.
 */
export function validateStep6Advanced(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.advanced.orchestrator.modelConfigId.trim()) {
    errors.orchestratorModel = 'validation.advanced.orchestratorModelRequired';
  }
  if (!config.advanced.mergeTerminal.cliTypeId.trim()) {
    errors.mergeCli = 'validation.advanced.mergeCliRequired';
  }
  if (!config.advanced.mergeTerminal.modelConfigId.trim()) {
    errors.mergeModel = 'validation.advanced.mergeModelRequired';
  }

  return errors;
}
