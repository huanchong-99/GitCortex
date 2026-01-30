import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, X, AlertTriangle } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { ErrorAlert } from '../../ui-new/primitives/ErrorAlert';
import { cn } from '@/lib/utils';
import type { WizardConfig, TerminalConfig } from '../types';
import { useErrorNotification } from '@/hooks/useErrorNotification';
import { useTranslation } from 'react-i18next';

interface Step4TerminalsProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
  onError?: (error: Error) => void;
}

interface CliType {
  id: string;
  name: string;
  installed: boolean;
  installGuide: string;
}

const CLI_TYPES: CliType[] = [
  { id: 'claude-code', name: 'Claude Code', installed: false, installGuide: 'https://claude.ai/code' },
  { id: 'gemini-cli', name: 'Gemini CLI', installed: false, installGuide: 'https://ai.google.dev/gemini-api/docs/cli' },
  { id: 'codex', name: 'Codex', installed: false, installGuide: 'https://docs.openai.com/codex' },
  { id: 'cursor-agent', name: 'Cursor Agent', installed: false, installGuide: 'https://cursor.sh/docs' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCliStatusMap = (value: unknown): value is Record<string, boolean> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every((entry) => typeof entry === 'boolean');
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

/**
 * Step 4: Assigns terminals and CLI/model settings for each task.
 */
export const Step4Terminals: React.FC<Step4TerminalsProps> = ({
  config,
  errors,
  onUpdate,
  onError,
}) => {
  const { notifyError } = useErrorNotification({ onError, context: 'Step4Terminals' });
  const { t } = useTranslation('workflow');
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [cliTypes, setCliTypes] = useState(CLI_TYPES);

  // Filter to only installed CLI types
  const availableCliTypes = cliTypes.filter((ct) => ct.installed);

  // Get current task
  const hasTasks = config.tasks.length > 0;
  const currentTask = hasTasks ? config.tasks[currentTaskIndex] : null;

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
      try {
        const response = await fetch('/api/cli_types/detect');
        const data = await parseJson(response);
        if (response.ok && isCliStatusMap(data)) {
          setCliTypes((prev) =>
            prev.map((cli) => ({
              ...cli,
              installed: data[cli.id] ?? false,
            }))
          );
        }
      } catch (error) {
        notifyError(error, 'detectCliTypes');
      }
    };

    void detectCliTypes();
  }, [notifyError]);

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

  // Get terminals for current task, sorted by orderIndex
  const taskTerminals = config.terminals
    .filter((terminal) => terminal.taskId === currentTask.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const taskNameValue = currentTask.name.trim();
  const taskName = taskNameValue
    ? currentTask.name
    : t('step4.taskNameFallback', { index: currentTaskIndex + 1 });

  return (
    <div className="flex flex-col gap-base">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-high font-medium">{t('step4.title')}</h2>
        <div className="text-base text-low">
          {t('step4.taskIndicator', { current: currentTaskIndex + 1, total: config.tasks.length })}
        </div>
      </div>

      {/* No CLI Installed Error */}
      {availableCliTypes.length === 0 && (
        <ErrorAlert message={t('step4.errors.noCliInstalled')} />
      )}

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
            {t('step4.previousTask')}
          </button>

          <div className="text-base text-normal">
            {taskName}
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
            {t('step4.nextTask')}
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Terminal Count Display */}
      <div className="text-base text-normal">
        {t('step4.terminalCount', { count: currentTask.terminalCount })}
      </div>

      {/* CLI Installation Status */}
      <div className="bg-secondary border rounded-sm p-base">
        <div className="text-base text-high font-medium mb-base">{t('step4.cliStatusTitle')}</div>
        <div className="grid grid-cols-2 gap-base">
          {cliTypes.map((cli) => (
            <div
              key={cli.id}
              className="flex items-center justify-between p-base rounded-sm bg-panel border"
            >
              <div className="flex items-center gap-base">
                {cli.installed ? (
                  <Check className="size-icon-sm text-success" strokeWidth={3} />
                ) : (
                  <X className="size-icon-sm text-error" strokeWidth={3} />
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
                  {t('step4.installGuide')}
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
              {t('step4.terminalLabel', { index: terminal.orderIndex + 1 })}
            </div>

            <div className="flex flex-col gap-base">
              {/* CLI Type Selection */}
              <Field>
                <FieldLabel>{t('step4.cliTypeLabel')}</FieldLabel>

                {/* Warning if CLI is not installed */}
                {terminal.cliTypeId && !cliTypes.find((ct) => ct.id === terminal.cliTypeId)?.installed && (
                  <div className="mb-base flex items-start gap-half p-base border border-warning bg-warning/10 rounded-sm">
                    <AlertTriangle className="size-icon-sm text-warning shrink-0 mt-quarter" />
                    <div className="flex-1">
                      <div className="text-base text-warning font-medium mb-quarter">
                        {t('step4.cliNotInstalledTitle')}
                      </div>
                      <div className="text-sm text-warning/80">
                        {t('step4.cliNotInstalledDescription')}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-base">
                  {cliTypes.map((cli) => (
                    <button
                      key={cli.id}
                      type="button"
                      onClick={() => {
                        updateTerminal(terminal.id, { cliTypeId: cli.id });
                      }}
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
                        <Check className="size-icon-sm text-success" strokeWidth={3} />
                      ) : (
                        <X className="size-icon-sm text-error" strokeWidth={3} />
                      )}
                      {cli.name}
                    </button>
                  ))}
                </div>
                {errors[`terminal-${terminal.id}-cli`] && (
                  <FieldError>{t(errors[`terminal-${terminal.id}-cli`])}</FieldError>
                )}
              </Field>

              {/* Model Selection */}
              <Field>
                <FieldLabel>{t('step4.modelLabel')}</FieldLabel>
                <select
                  value={terminal.modelConfigId}
                  onChange={(e) => {
                    updateTerminal(terminal.id, { modelConfigId: e.target.value });
                  }}
                  className={cn(
                    'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                    'focus:outline-none focus:ring-1 focus:ring-brand',
                    errors[`terminal-${terminal.id}-model`] && 'border-error'
                  )}
                >
                  <option value="">{t('step4.modelPlaceholder')}</option>
                  {config.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
                {errors[`terminal-${terminal.id}-model`] && (
                  <FieldError>{t(errors[`terminal-${terminal.id}-model`])}</FieldError>
                )}
              </Field>

              {/* Role Description */}
              <Field>
                <FieldLabel>{t('step4.roleLabel')}</FieldLabel>
                <input
                  type="text"
                  value={terminal.role ?? ''}
                  onChange={(e) => {
                    updateTerminal(terminal.id, { role: e.target.value });
                  }}
                  placeholder={t('step4.rolePlaceholder')}
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
