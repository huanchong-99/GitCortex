import type { WizardConfig } from '../types';

export function validateStep6Advanced(config: WizardConfig): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!config.advanced.orchestrator.modelConfigId?.trim()) {
    errors.orchestratorModel = '请选择主 Agent 模型';
  }
  if (!config.advanced.mergeTerminal.cliTypeId?.trim()) {
    errors.mergeCli = '请选择合并终端 CLI 类型';
  }
  if (!config.advanced.mergeTerminal.modelConfigId?.trim()) {
    errors.mergeModel = '请选择合并终端模型';
  }

  return errors;
}
