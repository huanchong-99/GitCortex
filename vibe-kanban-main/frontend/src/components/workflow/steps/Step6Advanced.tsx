import React from 'react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { CollapsibleSection } from '../../ui-new/primitives/CollapsibleSection';
import { cn } from '@/lib/utils';
import { CLI_TYPES, GIT_COMMIT_FORMAT } from '../constants';
import type { WizardConfig, AdvancedConfig } from '../types';

interface Step6AdvancedProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

export const Step6Advanced: React.FC<Step6AdvancedProps> = ({
  config,
  errors,
  onUpdate,
}) => {
  const advancedConfig = config.advanced;

  // Helper function to update orchestrator config
  const updateOrchestrator = (updates: Partial<AdvancedConfig['orchestrator']>) => {
    onUpdate({
      advanced: {
        ...advancedConfig,
        orchestrator: {
          ...advancedConfig.orchestrator,
          ...updates,
        },
      },
    });
  };

  // Helper function to update error terminal config
  const updateErrorTerminal = (updates: Partial<AdvancedConfig['errorTerminal']>) => {
    onUpdate({
      advanced: {
        ...advancedConfig,
        errorTerminal: {
          ...advancedConfig.errorTerminal,
          ...updates,
        },
      },
    });
  };

  // Helper function to update merge terminal config
  const updateMergeTerminal = (updates: Partial<AdvancedConfig['mergeTerminal']>) => {
    onUpdate({
      advanced: {
        ...advancedConfig,
        mergeTerminal: {
          ...advancedConfig.mergeTerminal,
          ...updates,
        },
      },
    });
  };

  const handleOrchestratorModelChange = (modelConfigId: string) => {
    updateOrchestrator({ modelConfigId });
  };

  const handleErrorTerminalEnabledChange = (enabled: boolean) => {
    if (!enabled) {
      updateErrorTerminal({ enabled, cliTypeId: undefined, modelConfigId: undefined });
    } else {
      updateErrorTerminal({ enabled });
    }
  };

  const handleErrorTerminalCliChange = (cliTypeId: string) => {
    updateErrorTerminal({ cliTypeId });
  };

  const handleErrorTerminalModelChange = (modelConfigId: string) => {
    updateErrorTerminal({ modelConfigId });
  };

  const handleMergeTerminalCliChange = (cliTypeId: string) => {
    updateMergeTerminal({ cliTypeId });
  };

  const handleMergeTerminalModelChange = (modelConfigId: string) => {
    updateMergeTerminal({ modelConfigId });
  };

  const handleRunTestsBeforeMergeChange = (runTestsBeforeMerge: boolean) => {
    updateMergeTerminal({ runTestsBeforeMerge });
  };

  const handlePauseOnConflictChange = (pauseOnConflict: boolean) => {
    updateMergeTerminal({ pauseOnConflict });
  };

  const handleTargetBranchChange = (targetBranch: string) => {
    onUpdate({
      advanced: {
        ...advancedConfig,
        targetBranch,
      },
    });
  };

  return (
    <div className="flex flex-col gap-base">
      {/* Orchestrator Configuration */}
      <Field>
        <FieldLabel htmlFor="orchestratorModel">主 Agent 配置</FieldLabel>
        <div className="text-sm text-low mb-half">
          选择用于协调多任务并行执行的主 AI 模型
        </div>
        <select
          id="orchestratorModel"
          value={advancedConfig.orchestrator.modelConfigId}
          onChange={(e) => handleOrchestratorModelChange(e.target.value)}
          className={cn(
            'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
            'focus:outline-none focus:ring-1 focus:ring-brand',
            errors.orchestratorModel && 'border-error'
          )}
        >
          <option value="">请选择模型</option>
          {config.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
            </option>
          ))}
        </select>
        {errors.orchestratorModel && <FieldError>{errors.orchestratorModel}</FieldError>}
      </Field>

      {/* Error Terminal Configuration */}
      <Field>
        <div className="flex items-center gap-base mb-half">
          <input
            type="checkbox"
            id="errorTerminalEnabled"
            checked={advancedConfig.errorTerminal.enabled}
            onChange={(e) => handleErrorTerminalEnabledChange(e.target.checked)}
            className="size-icon-sm accent-brand"
          />
          <FieldLabel htmlFor="errorTerminalEnabled" className="mb-0">
            启用错误恢复终端（可选）
          </FieldLabel>
        </div>
        <div className="text-sm text-low mb-base">
          当任务执行失败时，自动使用独立的终端进行错误恢复
        </div>

        {advancedConfig.errorTerminal.enabled && (
          <div className="flex flex-col gap-base p-base border rounded-sm bg-panel">
            {/* CLI Selection */}
            <Field>
              <FieldLabel htmlFor="errorTerminalCli">错误恢复 CLI</FieldLabel>
              <select
                id="errorTerminalCli"
                value={advancedConfig.errorTerminal.cliTypeId || ''}
                onChange={(e) => handleErrorTerminalCliChange(e.target.value)}
                className={cn(
                  'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                  'focus:outline-none focus:ring-1 focus:ring-brand',
                  errors.errorTerminalCli && 'border-error'
                )}
              >
                <option value="">请选择 CLI 类型</option>
                {Object.values(CLI_TYPES).map((cli) => (
                  <option key={cli.id} value={cli.id}>
                    {cli.label} - {cli.description}
                  </option>
                ))}
              </select>
              {errors.errorTerminalCli && <FieldError>{errors.errorTerminalCli}</FieldError>}
            </Field>

            {/* Model Selection */}
            <Field>
              <FieldLabel htmlFor="errorTerminalModel">错误恢复模型</FieldLabel>
              <select
                id="errorTerminalModel"
                value={advancedConfig.errorTerminal.modelConfigId || ''}
                onChange={(e) => handleErrorTerminalModelChange(e.target.value)}
                className={cn(
                  'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                  'focus:outline-none focus:ring-1 focus:ring-brand',
                  errors.errorTerminalModel && 'border-error'
                )}
              >
                <option value="">请选择模型</option>
                {config.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                  </option>
                ))}
              </select>
              {errors.errorTerminalModel && <FieldError>{errors.errorTerminalModel}</FieldError>}
            </Field>
          </div>
        )}
      </Field>

      {/* Merge Terminal Configuration */}
      <Field>
        <FieldLabel>合并终端配置</FieldLabel>
        <div className="text-sm text-low mb-base">
          配置用于自动合并任务分支的终端和模型
        </div>

        <div className="flex flex-col gap-base p-base border rounded-sm bg-panel">
          {/* CLI Selection */}
          <Field>
            <FieldLabel htmlFor="mergeTerminalCli">合并 CLI</FieldLabel>
            <select
              id="mergeTerminalCli"
              value={advancedConfig.mergeTerminal.cliTypeId}
              onChange={(e) => handleMergeTerminalCliChange(e.target.value)}
              className={cn(
                'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                'focus:outline-none focus:ring-1 focus:ring-brand',
                errors.mergeTerminalCli && 'border-error'
              )}
            >
              <option value="">请选择 CLI 类型</option>
              {Object.values(CLI_TYPES).map((cli) => (
                <option key={cli.id} value={cli.id}>
                  {cli.label} - {cli.description}
                </option>
              ))}
            </select>
            {errors.mergeTerminalCli && <FieldError>{errors.mergeTerminalCli}</FieldError>}
          </Field>

          {/* Model Selection */}
          <Field>
            <FieldLabel htmlFor="mergeTerminalModel">合并模型</FieldLabel>
            <select
              id="mergeTerminalModel"
              value={advancedConfig.mergeTerminal.modelConfigId}
              onChange={(e) => handleMergeTerminalModelChange(e.target.value)}
              className={cn(
                'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                'focus:outline-none focus:ring-1 focus:ring-brand',
                errors.mergeTerminalModel && 'border-error'
              )}
            >
              <option value="">请选择模型</option>
              {config.models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.displayName}
                </option>
              ))}
            </select>
            {errors.mergeTerminalModel && <FieldError>{errors.mergeTerminalModel}</FieldError>}
          </Field>

          {/* Checkboxes */}
          <div className="flex flex-col gap-base">
            <label className="flex items-center gap-base cursor-pointer">
              <input
                type="checkbox"
                checked={advancedConfig.mergeTerminal.runTestsBeforeMerge}
                onChange={(e) => handleRunTestsBeforeMergeChange(e.target.checked)}
                className="size-icon-sm accent-brand"
              />
              <span className="text-base text-normal">
                合并前运行测试
              </span>
            </label>

            <label className="flex items-center gap-base cursor-pointer">
              <input
                type="checkbox"
                checked={advancedConfig.mergeTerminal.pauseOnConflict}
                onChange={(e) => handlePauseOnConflictChange(e.target.checked)}
                className="size-icon-sm accent-brand"
              />
              <span className="text-base text-normal">
                冲突时暂停
              </span>
            </label>
          </div>
        </div>
      </Field>

      {/* Target Branch */}
      <Field>
        <FieldLabel htmlFor="targetBranch">目标分支</FieldLabel>
        <input
          id="targetBranch"
          type="text"
          value={advancedConfig.targetBranch}
          onChange={(e) => handleTargetBranchChange(e.target.value)}
          placeholder="例如：main"
          className={cn(
            'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
            'placeholder:text-low placeholder:opacity-80',
            'focus:outline-none focus:ring-1 focus:ring-brand',
            errors.targetBranch && 'border-error'
          )}
        />
        {errors.targetBranch && <FieldError>{errors.targetBranch}</FieldError>}
      </Field>

      {/* Git Commit Format */}
      <Field>
        <CollapsibleSection
          persistKey="wizard-git-commit-format"
          title="Git 提交格式（系统强制执行）"
          defaultExpanded={false}
        >
          <div className="mt-base">
            <div className="text-sm text-low mb-base">
              所有提交将遵循以下格式，由系统自动生成
            </div>
            <pre className="bg-secondary border rounded-sm p-base text-sm font-mono text-normal overflow-x-auto">
              {GIT_COMMIT_FORMAT}
            </pre>
          </div>
        </CollapsibleSection>
      </Field>
    </div>
  );
};
