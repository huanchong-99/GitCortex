import type { WizardConfig } from '../types';

/**
 * Validates task definitions for step 2.
 */
export function validateStep2Tasks(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (config.basic.executionMode === 'agent_planned') {
    return errors;
  }

  if (config.tasks.length === 0) {
    errors.tasks = 'validation.tasks.required';
    return errors;
  }

  const seenBranches = new Map<string, number>();

  config.tasks.forEach((task, index) => {
    if (!task.name.trim()) {
      errors[`task-${index}-name`] = 'validation.tasks.nameRequired';
    }
    if (!task.description.trim()) {
      errors[`task-${index}-description`] = 'validation.tasks.descriptionRequired';
    }
    if (task.branch.trim()) {
      const normalizedBranch = task.branch.trim().toLowerCase();
      const previousIndex = seenBranches.get(normalizedBranch);
      if (previousIndex === undefined) {
        seenBranches.set(normalizedBranch, index);
      } else {
        errors[`task-${index}-branch`] = 'validation.tasks.branchDuplicate';
        // Also mark the first occurrence if not already marked
        if (!errors[`task-${previousIndex}-branch`]) {
          errors[`task-${previousIndex}-branch`] = 'validation.tasks.branchDuplicate';
        }
      }
    } else {
      errors[`task-${index}-branch`] = 'validation.tasks.branchRequired';
    }
  });

  return errors;
}
