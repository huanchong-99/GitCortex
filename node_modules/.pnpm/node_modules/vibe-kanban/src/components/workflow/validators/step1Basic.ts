import type { WizardConfig } from '../types';

/**
 * Validates basic workflow metadata and task count.
 */
export function validateStep1Basic(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.basic.name.trim()) {
    errors.name = 'validation.basic.nameRequired';
  }

  if (config.basic.taskCount < 1) {
    errors.taskCount = 'validation.basic.taskCountMin';
  }

  return errors;
}
