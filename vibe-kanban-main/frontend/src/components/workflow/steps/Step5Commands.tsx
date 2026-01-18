import React, { useState, useEffect } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { cn } from '@/lib/utils';
import type { CommandConfig } from '../types';

// ============================================================================
// Types
// ============================================================================

interface CommandPreset {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isSystem: boolean;
}

interface Step5CommandsProps {
  config: CommandConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<CommandConfig>) => void;
}

// ============================================================================
// Constants
// ============================================================================

/** System presets - built-in command presets */
export const SYSTEM_PRESETS: CommandPreset[] = [
  {
    id: 'write-code',
    name: 'write-code',
    displayName: '编写代码',
    description: '根据需求编写新代码或功能',
    isSystem: true,
  },
  {
    id: 'review',
    name: 'review',
    displayName: '代码审查',
    description: '审查代码质量、安全性和最佳实践',
    isSystem: true,
  },
  {
    id: 'fix-issues',
    name: 'fix-issues',
    displayName: '修复问题',
    description: '修复 bug、错误和问题',
    isSystem: true,
  },
  {
    id: 'test',
    name: 'test',
    displayName: '运行测试',
    description: '执行测试套件并验证功能',
    isSystem: true,
  },
  {
    id: 'refactor',
    name: 'refactor',
    displayName: '代码重构',
    description: '重构代码以提高可维护性',
    isSystem: true,
  },
];

/** Default preset IDs */
const DEFAULT_PRESET_IDS = ['write-code', 'review'];

// ============================================================================
// Component
// ============================================================================

export const Step5Commands: React.FC<Step5CommandsProps> = ({
  config,
  errors,
  onUpdate,
}) => {
  const [userPresets, setUserPresets] = useState<CommandPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user presets from API
  useEffect(() => {
    const fetchUserPresets = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/workflows/presets/commands');
        if (response.ok) {
          const data: CommandPreset[] = await response.json();
          setUserPresets(data.filter((p) => !p.isSystem));
        }
      } catch (error) {
        console.error('Failed to fetch user presets:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPresets();
  }, []);

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
        <FieldLabel>斜杠命令配置</FieldLabel>
        <div className="flex flex-col gap-base">
          <label className="flex items-center gap-base cursor-pointer">
            <input
              type="radio"
              name="commandsEnabled"
              checked={config.enabled}
              onChange={() => handleEnabledChange(true)}
              className="size-icon-sm accent-brand"
            />
            <span className="text-base text-normal">
              启用斜杠命令
            </span>
          </label>
          <label className="flex items-center gap-base cursor-pointer">
            <input
              type="radio"
              name="commandsEnabled"
              checked={!config.enabled}
              onChange={() => handleEnabledChange(false)}
              className="size-icon-sm accent-brand"
            />
            <span className="text-base text-normal">
              不启用
            </span>
          </label>
        </div>
        {errors.enabled && <FieldError>{errors.enabled}</FieldError>}
      </Field>

      {/* Command List (shown only when enabled) */}
      {config.enabled && (
        <>
          {/* Selected Commands Section */}
          <Field>
            <FieldLabel>已选命令 (按执行顺序排列)</FieldLabel>

            {selectedPresets.length === 0 ? (
              /* Empty State */
              <div className="bg-secondary rounded-sm border p-double text-center">
                <p className="text-base text-low">
                  暂未选择任何命令，从下方预设中添加
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
                        {preset.displayName}
                      </div>
                      <div className="text-xs text-low truncate">
                        {preset.description}
                      </div>
                    </div>

                    {/* Move Buttons */}
                    <div className="flex items-center gap-sm">
                      <button
                        type="button"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                        className={cn(
                          'flex items-center justify-center p-half rounded border text-low',
                          'hover:text-normal hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                        aria-label="上移"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(index)}
                        disabled={index === selectedPresets.length - 1}
                        className={cn(
                          'flex items-center justify-center p-half rounded border text-low',
                          'hover:text-normal hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                        aria-label="下移"
                      >
                        ↓
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => removePreset(preset.id)}
                      className={cn(
                        'flex items-center justify-center p-half rounded border text-low',
                        'hover:text-error hover:border-error'
                      )}
                      aria-label="移除"
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
                  清除全部
                </button>
                <button
                  type="button"
                  onClick={resetDefault}
                  className={cn(
                    'px-base py-half rounded-sm border text-base text-low',
                    'hover:text-normal hover:border-brand'
                  )}
                >
                  重置默认
                </button>
              </div>
            )}
          </Field>

          {/* Available Presets */}
          <Field>
            <FieldLabel>可用预设</FieldLabel>

            {/* System Presets */}
            <div className="mb-base">
              <div className="text-sm text-high mb-base">系统预设</div>
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
                          {preset.displayName}
                        </div>
                        <div className="text-xs text-low truncate">
                          {preset.description}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addPreset(preset.id)}
                        disabled={isSelected}
                        className={cn(
                          'flex items-center justify-center p-half rounded border text-low',
                          'hover:text-normal hover:border-brand',
                          isSelected && 'opacity-50 cursor-not-allowed'
                        )}
                        aria-label="添加"
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
                <div className="text-sm text-high mb-base">用户预设</div>
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
                            {preset.displayName}
                          </div>
                          <div className="text-xs text-low truncate">
                            {preset.description}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addPreset(preset.id)}
                          disabled={isSelected}
                          className={cn(
                            'flex items-center justify-center p-half rounded border text-low',
                            'hover:text-normal hover:border-brand',
                            isSelected && 'opacity-50 cursor-not-allowed'
                          )}
                          aria-label="添加"
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
                加载用户预设中...
              </div>
            )}
          </Field>
        </>
      )}
    </div>
  );
};
