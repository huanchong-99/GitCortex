import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { cn } from '@/lib/utils';
import type { TaskConfig } from '../types';

const TERMINAL_COUNT_OPTIONS = [1, 2, 3];

interface Step2TasksProps {
  config: TaskConfig[];
  taskCount: number;
  onChange: (tasks: TaskConfig[]) => void;
  errors: Record<string, string>;
}

// Helper function to slugify text for branch names
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const Step2Tasks: React.FC<Step2TasksProps> = ({
  config,
  taskCount,
  onChange,
  errors,
}) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  // Initialize tasks when config length doesn't match taskCount
  useEffect(() => {
    if (config.length !== taskCount) {
      const newTasks: TaskConfig[] = Array.from({ length: taskCount }, (_, i) => ({
        id: `task-${Date.now()}-${i}`,
        name: '',
        description: '',
        branch: '',
        terminalCount: 1,
      }));
      onChange(newTasks);
    }
  }, [config.length, taskCount, onChange]);

  const updateTask = (index: number, updates: Partial<TaskConfig>) => {
    const newTasks = [...config];
    newTasks[index] = { ...newTasks[index], ...updates };
    onChange(newTasks);
  };

  const handleNameChange = (index: number, name: string) => {
    const updates: Partial<TaskConfig> = { name };

    // Auto-generate branch name from task name
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
    updateTask(index, { terminalCount: count });
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

  // Guard against rendering before tasks are initialized
  if (!config[currentTaskIndex]) {
    return null;
  }

  const currentTask = config[currentTaskIndex];

  // Calculate progress
  const completedTasks = config.filter(
    (task) => task.name && task.description && task.branch
  ).length;

  return (
    <div className="flex flex-col gap-base">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-high font-medium">
          配置 {taskCount} 个并行任务
        </h2>
        <div className="text-base text-low">
          进度: {completedTasks}/{taskCount}
        </div>
      </div>

      {/* Progress Indicator */}
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

      {/* Task Navigation */}
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
            上一个任务
          </button>

          <div className="text-base text-normal">
            任务 {currentTaskIndex + 1} / {taskCount}
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
            下一个任务
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Task Configuration Form */}
      <div className="flex flex-col gap-base">
        {/* Task Name */}
        <Field>
          <FieldLabel>任务名称</FieldLabel>
          <input
            type="text"
            value={currentTask.name}
            onChange={(e) => handleNameChange(currentTaskIndex, e.target.value)}
            placeholder="例如：登录功能"
            className={cn(
              'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
              'placeholder:text-low placeholder:opacity-80',
              'focus:outline-none focus:ring-1 focus:ring-brand',
              errors[`task-${currentTaskIndex}-name`] && 'border-error'
            )}
          />
          {errors[`task-${currentTaskIndex}-name`] && (
            <FieldError>{errors[`task-${currentTaskIndex}-name`]}</FieldError>
          )}
        </Field>

        {/* Branch Name */}
        <Field>
          <FieldLabel>Git 分支名</FieldLabel>
          <input
            type="text"
            value={currentTask.branch}
            onChange={(e) => handleBranchChange(currentTaskIndex, e.target.value)}
            placeholder="feat/feature-name"
            className={cn(
              'w-full bg-secondary rounded-sm border px-base py-half text-base text-normal font-mono',
              'placeholder:text-low placeholder:opacity-80',
              'focus:outline-none focus:ring-1 focus:ring-brand',
              errors[`task-${currentTaskIndex}-branch`] && 'border-error'
            )}
          />
          {errors[`task-${currentTaskIndex}-branch`] && (
            <FieldError>{errors[`task-${currentTaskIndex}-branch`]}</FieldError>
          )}
        </Field>

        {/* Description */}
        <Field>
          <FieldLabel>任务描述</FieldLabel>
          <textarea
            value={currentTask.description}
            onChange={(e) =>
              handleDescriptionChange(currentTaskIndex, e.target.value)
            }
            placeholder="详细描述这个任务的目标、范围和预期结果..."
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
            <FieldError>{errors[`task-${currentTaskIndex}-description`]}</FieldError>
          )}
        </Field>

        {/* Terminal Count Selection */}
        <Field>
          <FieldLabel>此任务需要几个终端串行执行？</FieldLabel>
          <div className="flex flex-wrap gap-base">
            {TERMINAL_COUNT_OPTIONS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleTerminalCountSelect(currentTaskIndex, count)}
                className={cn(
                  'px-base py-half rounded-sm border text-base transition-colors',
                  'hover:border-brand hover:text-high',
                  currentTask.terminalCount === count
                    ? 'border-brand bg-brand/10 text-high'
                    : 'border-border text-normal bg-secondary'
                )}
              >
                {count} 个终端
              </button>
            ))}
          </div>
          {errors[`task-${currentTaskIndex}-terminalCount`] && (
            <FieldError>{errors[`task-${currentTaskIndex}-terminalCount`]}</FieldError>
          )}
        </Field>
      </div>
    </div>
  );
};
