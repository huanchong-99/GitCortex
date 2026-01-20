import type { WizardConfig } from '../types';

/**
 * Validates task definitions for step 2.
 */
export function validateStep2Tasks(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (config.tasks.length === 0) {
    errors.tasks = 'validation.tasks.required';
    return errors;
  }

  config.tasks.forEach((task, index) => {
    if (!task.name.trim()) {
      errors[`task-${index}-name`] = 'validation.tasks.nameRequired';
    }
    if (!task.description.trim()) {
      errors[`task-${index}-description`] = 'validation.tasks.descriptionRequired';
    }
  });

  return errors;
}
