import React from 'react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { cn } from '@/lib/utils';
import type { BasicConfig } from '../types';

const TASK_COUNT_OPTIONS = [1, 2, 3, 4];

interface Step1BasicProps {
  config: BasicConfig;
  onChange: (updates: Partial<BasicConfig>) => void;
  errors: Record<string, string>;
}

export const Step1Basic: React.FC<Step1BasicProps> = ({
  config,
  onChange,
  errors,
}) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ name: e.target.value });
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange({ description: e.target.value });
  };

  const handleTaskCountSelect = (count: number) => {
    onChange({ taskCount: count });
  };

  const handleCustomTaskCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 5 && value <= 10) {
      onChange({ taskCount: value });
    }
  };

  const handleImportModeChange = (importFromKanban: boolean) => {
    onChange({ importFromKanban });
  };

  return (
    <div className="flex flex-col gap-base">
      {/* Workflow Name */}
      <Field>
        <FieldLabel>工作流名称</FieldLabel>
        <input
          type="text"
          value={config.name}
          onChange={handleNameChange}
          placeholder="例如：重构用户认证系统"
          className={cn(
            'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
            'placeholder:text-low placeholder:opacity-80',
            'focus:outline-none focus:ring-1 focus:ring-brand',
            errors.name && 'border-error'
          )}
        />
        {errors.name && <FieldError>{errors.name}</FieldError>}
      </Field>

      {/* Description */}
      <Field>
        <FieldLabel>工作流描述（可选）</FieldLabel>
        <textarea
          value={config.description || ''}
          onChange={handleDescriptionChange}
          placeholder="简要描述工作流的目标和范围..."
          rows={3}
          className={cn(
            'w-full bg-secondary rounded-sm border px-base py-half text-base text-normal',
            'placeholder:text-low placeholder:opacity-80',
            'focus:outline-none focus:ring-1 focus:ring-brand',
            'resize-none'
          )}
        />
      </Field>

      {/* Task Count Selection */}
      <Field>
        <FieldLabel>本次启动几个并行任务？</FieldLabel>
        <div className="flex flex-wrap gap-base">
          {TASK_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => handleTaskCountSelect(count)}
              className={cn(
                'px-base py-half rounded-sm border text-base transition-colors',
                'hover:border-brand hover:text-high',
                config.taskCount === count
                  ? 'border-brand bg-brand/10 text-high'
                  : 'border-border text-normal bg-secondary'
              )}
            >
              {count} 个任务
            </button>
          ))}
        </div>
        <div className="mt-base flex items-center gap-base">
          <span className="text-base text-low">或自定义数量 (5-10):</span>
          <input
            type="number"
            min={5}
            max={10}
            value={config.taskCount >= 5 && config.taskCount <= 10 ? config.taskCount : ''}
            onChange={handleCustomTaskCountChange}
            placeholder="5-10"
            className={cn(
              'w-20 bg-secondary rounded-sm border px-base py-half text-base text-normal',
              'placeholder:text-low placeholder:opacity-80',
              'focus:outline-none focus:ring-1 focus:ring-brand'
            )}
          />
        </div>
        {errors.taskCount && <FieldError>{errors.taskCount}</FieldError>}
      </Field>

      {/* Import Mode */}
      <Field>
        <FieldLabel>任务来源</FieldLabel>
        <div className="flex flex-col gap-base">
          <label className="flex items-center gap-base cursor-pointer">
            <input
              type="radio"
              name="importMode"
              checked={!config.importFromKanban}
              onChange={() => handleImportModeChange(false)}
              className="size-icon-sm accent-brand"
            />
            <span className="text-base text-normal">
              新建任务（在下一步中配置）
            </span>
          </label>
          <label className="flex items-center gap-base cursor-pointer">
            <input
              type="radio"
              name="importMode"
              checked={config.importFromKanban}
              onChange={() => handleImportModeChange(true)}
              className="size-icon-sm accent-brand"
            />
            <span className="text-base text-normal">
              从看板导入（选择已有任务卡片）
            </span>
          </label>
        </div>
      </Field>
    </div>
  );
};
