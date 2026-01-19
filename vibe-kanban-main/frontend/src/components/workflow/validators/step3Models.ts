import type { WizardConfig } from '../types';

export function validateStep3Models(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (config.models.length === 0) {
    errors.models = '请至少添加一个模型配置';
  }

  return errors;
}
