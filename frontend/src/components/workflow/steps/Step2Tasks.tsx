import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { cn } from '@/lib/utils';
import type { TaskConfig } from '../types';
import { useTranslation } from 'react-i18next';

/** Quick select options for terminal count */
const TERMINAL_COUNT_QUICK_OPTIONS = [1, 2, 3, 4, 5];
/** Maximum allowed terminal count */
const MAX_TERMINAL_COUNT = 10;
/** Minimum allowed terminal count */
const MIN_TERMINAL_COUNT = 1;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface Step2TasksProps {
  config: TaskConfig[];
  taskCount: number;
  onChange: (tasks: TaskConfig[]) => void;
  errors: Record<string, string>;
}

/**
 * Step 2: Configures task details and per-task terminal counts.
 */
export const Step2Tasks: React.FC<Step2TasksProps> = ({
  config,
  taskCount,
  onChange,
  errors,
}) => {
  const { t } = useTranslation('workflow');
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  // Use ref to store onChange to avoid triggering effect on every render
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Reset currentTaskIndex if it's out of bounds when taskCount changes
  useEffect(() => {
    if (currentTaskIndex >= taskCount && taskCount > 0) {
      setCurrentTaskIndex(taskCount - 1);
    }
  }, [currentTaskIndex, taskCount]);

  // Only initialize tasks when taskCount changes and config doesn't match
  useEffect(() => {
    if (config.length !== taskCount) {
      const newTasks: TaskConfig[] = Array.from({ length: taskCount }, (_, i) => ({
        id: `task-${Date.now()}-${i}`,
        name: '',
        description: '',
        branch: '',
        terminalCount: 1,
      }));
      onChangeRef.current(newTasks);
    }
  }, [config.length, taskCount]);

  const updateTask = (index: number, updates: Partial<TaskConfig>) => {
    const newTasks = [...config];
    newTasks[index] = { ...newTasks[index], ...updates };
    onChange(newTasks);
  };

  const handleNameChange = (index: number, name: string) => {
    const updates: Partial<TaskConfig> = { name };

    if (name && !config[index]?.branch) {
      updates.branch = `feat/${slugify(name)}`;
    }

    updateTask(index, updates);
  };

  const handleBranchChange = (index: number, branch: string) => {
    updateTask(index, { branch });
  };

  const handleDescriptionChange = (index: number, description: string) => {
    updateTask(index, { description });
  };

  const handleTerminalCountSelect = (index: number, count: number) => {
    // Clamp value to valid range
    const clampedCount = Math.max(MIN_TERMINAL_COUNT, Math.min(MAX_TERMINAL_COUNT, count));
    updateTask(index, { terminalCount: clampedCount });
  };

  const handleCustomTerminalCount = (index: number, value: string) => {
    const count = parseInt(value, 10);
    if (!isNaN(count)) {
      handleTerminalCountSelect(index, count);
    }
  };

  const goToPreviousTask = () => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(currentTaskIndex - 1);
    }
  };

  const goToNextTask = () => {
    if (currentTaskIndex < taskCount - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    }
  };

  if (!config[currentTaskIndex]) {
    return null;
  }

  const currentTask = config[currentTaskIndex];
  const completedTasks = config.filter(
    (task) => task.name && task.description && task.branch
  ).length;

  return (
    <div className="flex flex-col gap-base">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-high font-medium">
          {t('step2.header', { count: taskCount })}
        </h2>
        <div className="text-base text-low">
          {t('step2.progress', { completed: completedTasks, total: taskCount })}
        </div>
      </div>

      <div className="flex gap-half">
        {Array.from({ length: taskCount }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-1 flex-1 rounded-sm transition-colors',
              index < completedTasks
                ? 'bg-brand'
                : index === currentTaskIndex
                ? 'bg-brand/50'
                : 'bg-border'
            )}
          />
        ))}
      </div>

      {taskCount > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={goToPreviousTask}
            disabled={currentTaskIndex === 0}
            className={cn(
              'flex items-center gap-half px-base py-half rounded-sm border text-base',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'hover:border-brand hover:text-high',
              'border-border text-normal bg-secondary'
            )}
          >
            <ChevronLeft size={16} />
            {t('step2.previousTask')}
          </button>

          <div className="text-base text-normal">
            {t('step2.taskIndicator', {
              current: currentTaskIndex + 1,
              total: taskCount,
            })}
          </div>

          <button
            type="button"
            onClick={goToNextTask}
            disabled={currentTaskIndex === taskCount - 1}
            className={cn(
              'flex items-center gap-half px-base py-half rounded-sm border text-base',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'hover:border-brand hover:text-high',
              'border-border text-normal bg-secondary'
            )}
          >
            {t('step2.nextTask')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-base">
        <Field>
          <FieldLabel>{t('step2.nameLabel')}</FieldLabel>
          <input
            type="text"
            value={currentTask.name}
            onChange={(e) => {
              handleNameChange(currentTaskIndex, e.target.value);
            }}
            placeholder={t('step2.namePlaceholder')}
            className={cn(
              'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
              'placeholder:text-low placeholder:opacity-80',
              'focus:outline-none focus:ring-1 focus:ring-brand',
              errors[`task-${currentTaskIndex}-name`] && 'border-error'
            )}
          />
          {errors[`task-${currentTaskIndex}-name`] && (
            <FieldError>{t(errors[`task-${currentTaskIndex}-name`])}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>{t('step2.branchLabel')}</FieldLabel>
          <input
            type="text"
            value={currentTask.branch}
            onChange={(e) => {
              handleBranchChange(currentTaskIndex, e.target.value);
            }}
            placeholder={t('step2.branchPlaceholder')}
            className={cn(
              'w-full bg-secondary rounded-sm border px-base py-half text-base text-normal font-mono',
              'placeholder:text-low placeholder:opacity-80',
              'focus:outline-none focus:ring-1 focus:ring-brand',
              errors[`task-${currentTaskIndex}-branch`] && 'border-error'
            )}
          />
          {errors[`task-${currentTaskIndex}-branch`] && (
            <FieldError>{t(errors[`task-${currentTaskIndex}-branch`])}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>{t('step2.descriptionLabel')}</FieldLabel>
          <textarea
            value={currentTask.description}
            onChange={(e) => {
              handleDescriptionChange(currentTaskIndex, e.target.value);
            }}
            placeholder={t('step2.descriptionPlaceholder')}
            rows={4}
            className={cn(
              'w-full bg-secondary rounded-sm border px-base py-half text-base text-normal',
              'placeholder:text-low placeholder:opacity-80',
              'focus:outline-none focus:ring-1 focus:ring-brand',
              'resize-none',
              errors[`task-${currentTaskIndex}-description`] && 'border-error'
            )}
          />
          {errors[`task-${currentTaskIndex}-description`] && (
            <FieldError>{t(errors[`task-${currentTaskIndex}-description`])}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>
            {t('step2.terminalCountLabel')}
            <span className="ml-2 text-low font-normal text-sm">
              ({MIN_TERMINAL_COUNT}-{MAX_TERMINAL_COUNT})
            </span>
          </FieldLabel>
          <div className="flex flex-wrap items-center gap-base">
            {TERMINAL_COUNT_QUICK_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => {
                  handleTerminalCountSelect(currentTaskIndex, count);
                }}
                className={cn(
                  'px-base py-half rounded-sm border text-base transition-colors',
                  'hover:border-brand hover:text-high',
                  currentTask.terminalCount === count
                    ? 'border-brand bg-brand/10 text-high'
                    : 'border-border text-normal bg-secondary'
                )}
              >
                {count}
              </button>
            ))}
            <div className="flex items-center gap-half">
              <span className="text-low text-sm">{t('step2.customCount', { defaultValue: 'Custom:' })}</span>
              <input
                type="number"
                min={MIN_TERMINAL_COUNT}
                max={MAX_TERMINAL_COUNT}
                value={currentTask.terminalCount}
                onChange={(e) => {
                  handleCustomTerminalCount(currentTaskIndex, e.target.value);
                }}
                className={cn(
                  'w-16 bg-secondary rounded-sm border px-half py-half text-base text-high text-center',
                  'focus:outline-none focus:ring-1 focus:ring-brand',
                  'border-border'
                )}
              />
            </div>
          </div>
          {errors[`task-${currentTaskIndex}-terminalCount`] && (
            <FieldError>{t(errors[`task-${currentTaskIndex}-terminalCount`])}</FieldError>
          )}
        </Field>
      </div>
    </div>
  );
};
