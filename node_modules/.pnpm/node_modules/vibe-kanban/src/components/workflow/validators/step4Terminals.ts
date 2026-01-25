import type { WizardConfig } from '../types';

/**
 * Validates terminal assignments for step 4.
 */
export function validateStep4Terminals(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (config.terminals.length === 0) {
    errors.terminals = 'validation.terminals.required';
    return errors;
  }

  config.terminals.forEach((terminal, index) => {
    if (!terminal.cliTypeId.trim()) {
      errors[`terminal-${index}-cli`] = 'validation.terminals.cliRequired';
    }
    if (!terminal.modelConfigId.trim()) {
      errors[`terminal-${index}-model`] = 'validation.terminals.modelRequired';
    }
  });

  return errors;
}
