import type { WizardConfig } from '../types';

export function validateStep1Basic(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.basic.name?.trim()) {
    errors.name = '请输入工作流名称';
  }

  if (config.basic.taskCount < 1) {
    errors.taskCount = '任务数量必须至少为 1';
  }

  return errors;
}
