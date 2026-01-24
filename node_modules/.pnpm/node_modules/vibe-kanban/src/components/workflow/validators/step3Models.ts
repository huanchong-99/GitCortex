import type { WizardConfig } from '../types';

/**
 * Validates model configuration presence for step 3.
 */
export function validateStep3Models(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (config.models.length === 0) {
    errors.models = 'validation.models.required';
  }

  return errors;
}
