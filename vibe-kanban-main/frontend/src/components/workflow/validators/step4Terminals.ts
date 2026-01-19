import type { WizardConfig } from '../types';

export function validateStep4Terminals(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.terminals || config.terminals.length === 0) {
    errors.terminals = '请至少添加一个终端配置';
    return errors;
  }

  config.terminals.forEach((terminal, index) => {
    if (!terminal.cliTypeId?.trim()) {
      errors[`terminal-${index}-cli`] = '请选择 CLI 类型';
    }
    if (!terminal.modelConfigId?.trim()) {
      errors[`terminal-${index}-model`] = '请选择模型配置';
    }
  });

  return errors;
}
