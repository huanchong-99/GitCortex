import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { cn } from '@/lib/utils';
import type { CommandConfig } from '../types';
import { useErrorNotification } from '@/hooks/useErrorNotification';
import { useTranslation } from 'react-i18next';

// ============================================================================
// Types
// ============================================================================

interface CommandPreset {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  nameKey?: string;
  descriptionKey?: string;
  isSystem: boolean;
}

interface Step5CommandsProps {
  config: CommandConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<CommandConfig>) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** System presets - built-in command presets */
export const SYSTEM_PRESETS: CommandPreset[] = [
  {
    id: 'write-code',
    name: 'write-code',
    nameKey: 'step5.presets.writeCode.name',
    descriptionKey: 'step5.presets.writeCode.description',
    isSystem: true,
  },
  {
    id: 'review',
    name: 'review',
    nameKey: 'step5.presets.review.name',
    descriptionKey: 'step5.presets.review.description',
    isSystem: true,
  },
  {
    id: 'fix-issues',
    name: 'fix-issues',
    nameKey: 'step5.presets.fixIssues.name',
    descriptionKey: 'step5.presets.fixIssues.description',
    isSystem: true,
  },
  {
    id: 'test',
    name: 'test',
    nameKey: 'step5.presets.test.name',
    descriptionKey: 'step5.presets.test.description',
    isSystem: true,
  },
  {
    id: 'refactor',
    name: 'refactor',
    nameKey: 'step5.presets.refactor.name',
    descriptionKey: 'step5.presets.refactor.description',
    isSystem: true,
  },
];

/** Default preset IDs */
const DEFAULT_PRESET_IDS = ['write-code', 'review'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCommandPreset = (value: unknown): value is CommandPreset => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.isSystem === 'boolean'
  );
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

// ============================================================================
// Component
// ============================================================================

/**
 * Step 5: Configures slash command presets and ordering.
 */
export const Step5Commands: React.FC<Step5CommandsProps> = ({
  config,
  errors,
  onUpdate,
  onError,
}) => {
  const { notifyError } = useErrorNotification({ onError, context: 'Step5Commands' });
  const { t } = useTranslation('workflow');
  const [userPresets, setUserPresets] = useState<CommandPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getPresetName = (preset: CommandPreset) =>
    preset.nameKey ? t(preset.nameKey) : preset.displayName ?? preset.name;

  const getPresetDescription = (preset: CommandPreset) =>
    preset.descriptionKey ? t(preset.descriptionKey) : preset.description ?? '';

  // Fetch user presets from API
  useEffect(() => {
    const fetchUserPresets = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/workflows/presets/commands');
        if (response.ok) {
          const data = await parseJson(response);
          if (Array.isArray(data)) {
            const presets = data.filter(isCommandPreset);
            setUserPresets(presets.filter((preset) => !preset.isSystem));
          }
        }
      } catch (error) {
        notifyError(error, 'fetchUserPresets');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchUserPresets();
  }, [notifyError]);

  // Combine all presets
  const allPresets = [...SYSTEM_PRESETS, ...userPresets];

  // Get selected preset objects
  const selectedPresets = allPresets.filter((p) =>
    config.presetIds.includes(p.id)
  );

  // Handlers
  const handleEnabledChange = (enabled: boolean) => {
    if (enabled) {
      onUpdate({ enabled: true });
    } else {
      onUpdate({ enabled: false, presetIds: [] });
    }
  };

  const addPreset = (presetId: string) => {
    if (config.presetIds.includes(presetId)) return; // Prevent duplicates
    onUpdate({ presetIds: [...config.presetIds, presetId] });
  };

  const removePreset = (presetId: string) => {
    onUpdate({
      presetIds: config.presetIds.filter((id) => id !== presetId),
    });
  };

  const clearAll = () => {
    onUpdate({ presetIds: [] });
  };

  const resetDefault = () => {
    onUpdate({ presetIds: [...DEFAULT_PRESET_IDS] });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newPresetIds = [...config.presetIds];
    [newPresetIds[index - 1], newPresetIds[index]] = [
      newPresetIds[index],
      newPresetIds[index - 1],
    ];
    onUpdate({ presetIds: newPresetIds });
  };

  const moveDown = (index: number) => {
    if (index === config.presetIds.length - 1) return;
    const newPresetIds = [...config.presetIds];
    [newPresetIds[index], newPresetIds[index + 1]] = [
      newPresetIds[index + 1],
      newPresetIds[index],
    ];
    onUpdate({ presetIds: newPresetIds });
  };

  return (
    <div className="flex flex-col gap-base">
      {/* Enable/Disable Radio Buttons */}
      <Field>
        <FieldLabel>{t('step5.title')}</FieldLabel>
        <div className="flex flex-col gap-base">
          <label className="flex items-center gap-base cursor-pointer">
            <input
              type="radio"
              name="commandsEnabled"
              checked={config.enabled}
              onChange={() => {
                handleEnabledChange(true);
              }}
              className="size-icon-sm accent-brand"
            />
            <span className="text-base text-normal">
              {t('step5.enableLabel')}
            </span>
          </label>
          <label className="flex items-center gap-base cursor-pointer">
            <input
              type="radio"
              name="commandsEnabled"
              checked={!config.enabled}
              onChange={() => {
                handleEnabledChange(false);
              }}
              className="size-icon-sm accent-brand"
            />
            <span className="text-base text-normal">
              {t('step5.disableLabel')}
            </span>
          </label>
        </div>
        {errors.enabled && <FieldError>{t(errors.enabled)}</FieldError>}
      </Field>

      {/* Command List (shown only when enabled) */}
      {config.enabled && (
        <>
          {/* Selected Commands Section */}
          <Field>
            <FieldLabel>{t('step5.selectedTitle')}</FieldLabel>

            {selectedPresets.length === 0 ? (
              /* Empty State */
              <div className="bg-secondary rounded-sm border p-double text-center">
                <p className="text-base text-low">
                  {t('step5.selectedEmpty')}
                </p>
              </div>
            ) : (
              /* Command List */
              <div className="flex flex-col gap-sm">
                {selectedPresets.map((preset, index) => (
                  <div
                    key={preset.id}
                    className="flex items-center gap-base bg-secondary rounded-sm border px-base py-half"
                  >
                    {/* Drag Handle */}
                    <GripVertical className="size-icon-sm text-low shrink-0" />

                    {/* Command Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-base text-high truncate">
                        {getPresetName(preset)}
                      </div>
                      <div className="text-xs text-low truncate">
                        {getPresetDescription(preset)}
                      </div>
                    </div>

                    {/* Move Buttons */}
                    <div className="flex items-center gap-sm">
                      <button
                        type="button"
                        onClick={() => {
                          moveUp(index);
                        }}
                        disabled={index === 0}
                        className={cn(
                          'flex items-center justify-center p-half rounded border text-low',
                          'hover:text-normal hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                        aria-label={t('step5.moveUp')}
                      >
                        <ChevronUp className="size-icon-sm" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          moveDown(index);
                        }}
                        disabled={index === selectedPresets.length - 1}
                        className={cn(
                          'flex items-center justify-center p-half rounded border text-low',
                          'hover:text-normal hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                        aria-label={t('step5.moveDown')}
                      >
                        <ChevronDown className="size-icon-sm" />
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => {
                        removePreset(preset.id);
                      }}
                      className={cn(
                        'flex items-center justify-center p-half rounded border text-low',
                        'hover:text-error hover:border-error'
                      )}
                      aria-label={t('step5.remove')}
                    >
                      <X className="size-icon-sm" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            {selectedPresets.length > 0 && (
              <div className="mt-base flex gap-base">
                <button
                  type="button"
                  onClick={clearAll}
                  className={cn(
                    'px-base py-half rounded-sm border text-base text-low',
                    'hover:text-normal hover:border-brand'
                  )}
                >
                  {t('step5.clearAll')}
                </button>
                <button
                  type="button"
                  onClick={resetDefault}
                  className={cn(
                    'px-base py-half rounded-sm border text-base text-low',
                    'hover:text-normal hover:border-brand'
                  )}
                >
                  {t('step5.resetDefault')}
                </button>
              </div>
            )}
          </Field>

          {/* Available Presets */}
          <Field>
            <FieldLabel>{t('step5.availableTitle')}</FieldLabel>

            {/* System Presets */}
            <div className="mb-base">
              <div className="text-sm text-high mb-base">{t('step5.systemPresetsTitle')}</div>
              <div className="flex flex-col gap-sm">
                {SYSTEM_PRESETS.map((preset) => {
                  const isSelected = config.presetIds.includes(preset.id);
                  return (
                    <div
                      key={preset.id}
                      className={cn(
                        'flex items-center gap-base bg-secondary rounded-sm border px-base py-half',
                        isSelected && 'border-brand bg-brand/5'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-base text-high truncate">
                          {getPresetName(preset)}
                        </div>
                        <div className="text-xs text-low truncate">
                          {getPresetDescription(preset)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          addPreset(preset.id);
                        }}
                        disabled={isSelected}
                        className={cn(
                          'flex items-center justify-center p-half rounded border text-low',
                          'hover:text-normal hover:border-brand',
                          isSelected && 'opacity-50 cursor-not-allowed'
                        )}
                        aria-label={t('step5.add')}
                      >
                        <Plus className="size-icon-sm" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* User Presets */}
            {userPresets.length > 0 && (
              <div>
                <div className="text-sm text-high mb-base">{t('step5.userPresetsTitle')}</div>
                <div className="flex flex-col gap-sm">
                  {userPresets.map((preset) => {
                    const isSelected = config.presetIds.includes(preset.id);
                    return (
                      <div
                        key={preset.id}
                        className={cn(
                          'flex items-center gap-base bg-secondary rounded-sm border px-base py-half',
                          isSelected && 'border-brand bg-brand/5'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-base text-high truncate">
                            {getPresetName(preset)}
                          </div>
                          <div className="text-xs text-low truncate">
                            {getPresetDescription(preset)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            addPreset(preset.id);
                          }}
                          disabled={isSelected}
                          className={cn(
                            'flex items-center justify-center p-half rounded border text-low',
                            'hover:text-normal hover:border-brand',
                            isSelected && 'opacity-50 cursor-not-allowed'
                          )}
                          aria-label={t('step5.add')}
                        >
                          <Plus className="size-icon-sm" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="text-base text-low">
                {t('step5.loadingUserPresets')}
              </div>
            )}
          </Field>
        </>
      )}
    </div>
  );
};
