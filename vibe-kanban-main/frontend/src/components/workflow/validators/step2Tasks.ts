import type { WizardConfig } from '../types';

export function validateStep2Tasks(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.tasks || config.tasks.length === 0) {
    errors.tasks = '请至少添加一个任务';
    return errors;
  }

  config.tasks.forEach((task, index) => {
    if (!task.name?.trim()) {
      errors[`task-${index}-name`] = '请输入任务名称';
    }
    if (!task.description?.trim()) {
      errors[`task-${index}-description`] = '请输入任务描述';
    }
  });

  return errors;
}
