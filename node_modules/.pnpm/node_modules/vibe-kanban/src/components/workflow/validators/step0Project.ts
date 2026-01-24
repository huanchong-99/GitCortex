import type { WizardConfig } from '../types';

/**
 * Validates project selection fields for step 0.
 */
export function validateStep0Project(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.project.workingDirectory.trim()) {
    errors.workingDirectory = 'validation.project.workingDirectoryRequired';
  }

  return errors;
}
