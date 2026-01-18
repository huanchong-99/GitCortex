import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { cn } from '@/lib/utils';
import type { WizardConfig, TerminalConfig } from '../types';

interface Step4TerminalsProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

const CLI_TYPES = [
  { id: 'claude-code', name: 'Claude Code', installed: false, installGuide: 'https://claude.ai/code' },
  { id: 'gemini-cli', name: 'Gemini CLI', installed: false, installGuide: 'https://ai.google.dev/gemini-api/docs/cli' },
  { id: 'codex', name: 'Codex', installed: false, installGuide: 'https://docs.openai.com/codex' },
  { id: 'cursor-agent', name: 'Cursor Agent', installed: false, installGuide: 'https://cursor.sh/docs' },
] as const;

export const Step4Terminals: React.FC<Step4TerminalsProps> = ({
  config,
  errors,
  onUpdate,
}) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [cliTypes, setCliTypes] = useState(CLI_TYPES);
  const [isDetecting, setIsDetecting] = useState(false);

  // Get current task
  const currentTask = config.tasks[currentTaskIndex];

  // Get terminals for current task, sorted by orderIndex
  const taskTerminals = config.terminals
    .filter((t) => t.taskId === currentTask?.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Initialize terminals when config length mismatches task count
  useEffect(() => {
    if (!currentTask) return;

    const existingTerminals = config.terminals.filter((t) => t.taskId === currentTask.id);
    if (existingTerminals.length !== currentTask.terminalCount) {
      const newTerminals: TerminalConfig[] = Array.from(
        { length: currentTask.terminalCount },
        (_, i) => ({
          id: `terminal-${currentTask.id}-${i}`,
          taskId: currentTask.id,
          orderIndex: i,
          cliTypeId: '',
          modelConfigId: '',
          role: '',
        })
      );

      // Remove old terminals for this task and add new ones
      const otherTerminals = config.terminals.filter((t) => t.taskId !== currentTask.id);
      onUpdate({
        terminals: [...otherTerminals, ...newTerminals],
      });
    }
  }, [currentTask, config.terminals, onUpdate]);

  // Detect CLI installation status
  useEffect(() => {
    const detectCliTypes = async () => {
      setIsDetecting(true);
      try {
        const response = await fetch('/api/cli_types/detect');
        if (response.ok) {
          const data = await response.json();
          setCliTypes((prev) =>
            prev.map((cli) => ({
              ...cli,
              installed: data[cli.id] || false,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to detect CLI types:', error);
      } finally {
        setIsDetecting(false);
      }
    };

    detectCliTypes();
  }, []);

  const updateTerminal = (terminalId: string, updates: Partial<TerminalConfig>) => {
    const newTerminals = config.terminals.map((t) =>
      t.id === terminalId ? { ...t, ...updates } : t
    );
    onUpdate({ terminals: newTerminals });
  };

  const goToPreviousTask = () => {
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(currentTaskIndex - 1);
    }
  };

  const goToNextTask = () => {
    if (currentTaskIndex < config.tasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
    }
  };

  // Guard against rendering before tasks are initialized
  if (!currentTask) {
    return null;
  }

  return (
    <div className="flex flex-col gap-base">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-high font-medium">配置终端</h2>
        <div className="text-base text-low">
          任务 {currentTaskIndex + 1} / {config.tasks.length}
        </div>
      </div>

      {/* Task Navigation */}
      {config.tasks.length > 1 && (
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
            {currentTask.name || `任务 ${currentTaskIndex + 1}`}
          </div>

          <button
            type="button"
            onClick={goToNextTask}
            disabled={currentTaskIndex === config.tasks.length - 1}
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

      {/* Terminal Count Display */}
      <div className="text-base text-normal">
        此任务有 {currentTask.terminalCount} 个串行终端
      </div>

      {/* CLI Installation Status */}
      <div className="bg-secondary border rounded-sm p-base">
        <div className="text-base text-high font-medium mb-base">CLI 安装状态</div>
        <div className="grid grid-cols-2 gap-base">
          {cliTypes.map((cli) => (
            <div
              key={cli.id}
              className="flex items-center justify-between p-base rounded-sm bg-panel border"
            >
              <div className="flex items-center gap-base">
                {cli.installed ? (
                  <Check className="size-icon-sm text-success" weight="bold" />
                ) : (
                  <X className="size-icon-sm text-error" weight="bold" />
                )}
                <span className="text-base text-normal">{cli.name}</span>
              </div>
              {!cli.installed && (
                <a
                  href={cli.installGuide}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base text-brand hover:underline"
                >
                  安装指南
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Terminal Configuration Forms */}
      <div className="flex flex-col gap-base">
        {taskTerminals.map((terminal) => (
          <div
            key={terminal.id}
            className="bg-secondary border rounded-sm p-base"
          >
            <div className="text-base text-high font-medium mb-base">
              终端 {terminal.orderIndex + 1}
            </div>

            <div className="flex flex-col gap-base">
              {/* CLI Type Selection */}
              <Field>
                <FieldLabel>CLI 类型</FieldLabel>
                <div className="grid grid-cols-2 gap-base">
                  {cliTypes.map((cli) => (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => updateTerminal(terminal.id, { cliTypeId: cli.id })}
                      disabled={!cli.installed}
                      className={cn(
                        'flex items-center gap-half px-base py-half rounded-sm border text-base transition-colors',
                        'hover:border-brand hover:text-high',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        terminal.cliTypeId === cli.id
                          ? 'border-brand bg-brand/10 text-high'
                          : 'border-border text-normal bg-panel'
                      )}
                    >
                      {cli.installed ? (
                        <Check className="size-icon-sm text-success" weight="bold" />
                      ) : (
                        <X className="size-icon-sm text-error" weight="bold" />
                      )}
                      {cli.name}
                    </button>
                  ))}
                </div>
                {errors[`terminal-${terminal.id}-cli`] && (
                  <FieldError>{errors[`terminal-${terminal.id}-cli`]}</FieldError>
                )}
              </Field>

              {/* Model Selection */}
              <Field>
                <FieldLabel>模型配置</FieldLabel>
                <select
                  value={terminal.modelConfigId}
                  onChange={(e) =>
                    updateTerminal(terminal.id, { modelConfigId: e.target.value })
                  }
                  className={cn(
                    'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                    'focus:outline-none focus:ring-1 focus:ring-brand',
                    errors[`terminal-${terminal.id}-model`] && 'border-error'
                  )}
                >
                  <option value="">请选择模型</option>
                  {config.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                {errors[`terminal-${terminal.id}-model`] && (
                  <FieldError>{errors[`terminal-${terminal.id}-model`]}</FieldError>
                )}
              </Field>

              {/* Role Description */}
              <Field>
                <FieldLabel>角色描述（可选）</FieldLabel>
                <input
                  type="text"
                  value={terminal.role || ''}
                  onChange={(e) => updateTerminal(terminal.id, { role: e.target.value })}
                  placeholder="例如：负责后端 API 开发的专家"
                  className={cn(
                    'w-full bg-secondary rounded-sm border px-base py-half text-base text-normal',
                    'placeholder:text-low placeholder:opacity-80',
                    'focus:outline-none focus:ring-1 focus:ring-brand'
                  )}
                />
              </Field>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
