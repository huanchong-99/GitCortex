import type { WizardConfig } from '../types';

export function validateStep0Project(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.project.workingDirectory?.trim()) {
    errors.workingDirectory = '请选择项目文件夹';
  }

  return errors;
}
