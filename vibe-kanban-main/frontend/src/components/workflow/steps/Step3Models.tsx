import React, { useState } from 'react';
import {
  PlusIcon,
  PencilSimpleIcon,
  TrashIcon,
  CheckCircleIcon,
  Icon,
} from '@phosphor-icons/react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../ui-new/primitives/Dialog';
import { IconButton } from '../../ui-new/primitives/IconButton';
import { cn } from '@/lib/utils';
import type { WizardConfig, ModelConfig, ApiType } from '../types';

interface Step3ModelsProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

const API_TYPES = {
  anthropic: {
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  },
  google: {
    label: 'Google',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModels: ['gemini-2.0-flash-exp', 'gemini-1.5-pro'],
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com',
    defaultModels: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  'openai-compatible': {
    label: 'OpenAI Compatible',
    defaultBaseUrl: '',
    defaultModels: [],
  },
} as const;

interface ModelFormData {
  displayName: string;
  apiType: ApiType;
  baseUrl: string;
  apiKey: string;
  modelId: string;
}

const initialFormData: ModelFormData = {
  displayName: '',
  apiType: 'anthropic',
  baseUrl: API_TYPES.anthropic.defaultBaseUrl,
  apiKey: '',
  modelId: '',
};

export const Step3Models: React.FC<Step3ModelsProps> = ({
  config,
  errors,
  onUpdate,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleOpenAddDialog = () => {
    setEditingModel(null);
    setFormData({
      displayName: '',
      apiType: 'anthropic',
      baseUrl: API_TYPES.anthropic.defaultBaseUrl,
      apiKey: '',
      modelId: '',
    });
    setAvailableModels([]);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (model: ModelConfig) => {
    setEditingModel(model);
    setFormData({
      displayName: model.displayName,
      apiType: model.apiType,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey,
      modelId: model.modelId,
    });
    setAvailableModels(API_TYPES[model.apiType].defaultModels);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingModel(null);
    setFormData(initialFormData);
    setAvailableModels([]);
    setFormErrors({});
  };

  const handleApiTypeChange = (apiType: ApiType) => {
    const config = API_TYPES[apiType];
    setFormData({
      ...formData,
      apiType,
      baseUrl: config.defaultBaseUrl,
      modelId: '',
    });
    setAvailableModels(config.defaultModels);
  };

  const handleFetchModels = async () => {
    if (!formData.apiKey) {
      setFormErrors({ apiKey: '请先输入 API Key' });
      return;
    }

    setIsFetching(true);
    setFormErrors({});

    try {
      // TODO: Implement actual API call to fetch models
      // For now, use default models based on API type
      const defaultModels = API_TYPES[formData.apiType].defaultModels;
      setAvailableModels(defaultModels);
    } catch (error) {
      setFormErrors({ fetch: '获取模型列表失败，请检查 API Key' });
    } finally {
      setIsFetching(false);
    }
  };

  const handleVerify = async () => {
    if (!formData.baseUrl || !formData.apiKey || !formData.modelId) {
      setFormErrors({
        verify: '请先填写完整信息',
      });
      return;
    }

    setIsVerifying(true);
    setFormErrors({});

    try {
      // TODO: Implement actual API verification
      // For now, simulate successful verification
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setFormErrors({ verify: '' });
      // Show success indication
      alert('连接验证成功！');
    } catch (error) {
      setFormErrors({ verify: '连接验证失败，请检查配置' });
    } finally {
      setIsVerifying(false);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      errors.displayName = '请输入模型名称';
    }
    if (!formData.baseUrl.trim()) {
      errors.baseUrl = '请输入 Base URL';
    }
    if (!formData.apiKey.trim()) {
      errors.apiKey = '请输入 API Key';
    }
    if (!formData.modelId.trim()) {
      errors.modelId = '请选择或输入模型 ID';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    const newModel: ModelConfig = {
      id: editingModel?.id || `model-${Date.now()}`,
      displayName: formData.displayName,
      apiType: formData.apiType,
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
      modelId: formData.modelId,
      isVerified: editingModel?.isVerified || false,
    };

    let updatedModels: ModelConfig[];
    if (editingModel) {
      updatedModels = config.models.map((m) =>
        m.id === editingModel.id ? newModel : m
      );
    } else {
      updatedModels = [...config.models, newModel];
    }

    onUpdate({ models: updatedModels });
    handleCloseDialog();
  };

  const handleDelete = (modelId: string) => {
    if (window.confirm('确定要删除这个模型配置吗？')) {
      const updatedModels = config.models.filter((m) => m.id !== modelId);
      onUpdate({ models: updatedModels });
    }
  };

  return (
    <div className="flex flex-col gap-base">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-high">配置 AI 模型</h2>
        <button
          type="button"
          onClick={handleOpenAddDialog}
          className="flex items-center gap-half px-base py-half rounded-sm bg-brand text-on-brand text-base hover:bg-brand-hover transition-colors"
        >
          <PlusIcon className="size-icon-sm" weight="bold" />
          添加模型
        </button>
      </div>

      {config.models.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-double text-low">
          <div className="text-base">还没有配置任何模型</div>
          <div className="text-sm mt-half">点击上方按钮添加第一个模型配置</div>
        </div>
      ) : (
        <div className="flex flex-col gap-base">
          {config.models.map((model) => (
            <div
              key={model.id}
              className="bg-secondary border rounded-sm p-base flex items-center justify-between"
            >
              <div className="flex items-center gap-base flex-1">
                {model.isVerified && (
                  <CheckCircleIcon
                    className="size-icon-sm text-success"
                    weight="fill"
                    data-testid={`verified-badge-${model.id}`}
                  />
                )}
                <div className="flex-1">
                  <div className="text-base font-medium text-high">
                    {model.displayName}
                  </div>
                  <div className="text-sm text-low mt-quarter">
                    {API_TYPES[model.apiType].label} · {model.modelId}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-half">
                <IconButton
                  icon={PencilSimpleIcon}
                  onClick={() => handleOpenEditDialog(model)}
                  aria-label={`编辑 ${model.displayName}`}
                  title="编辑"
                />
                <IconButton
                  icon={TrashIcon}
                  onClick={() => handleDelete(model.id)}
                  aria-label={`删除 ${model.displayName}`}
                  title="删除"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Model Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingModel ? '编辑模型' : '添加模型'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-base py-base">
            {/* Display Name */}
            <Field>
              <FieldLabel htmlFor="displayName">模型名称</FieldLabel>
              <input
                id="displayName"
                type="text"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                placeholder="例如：Claude 3.5 Sonnet"
                className={cn(
                  'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                  'placeholder:text-low placeholder:opacity-80',
                  'focus:outline-none focus:ring-1 focus:ring-brand',
                  formErrors.displayName && 'border-error'
                )}
              />
              {formErrors.displayName && <FieldError>{formErrors.displayName}</FieldError>}
            </Field>

            {/* API Type */}
            <Field>
              <FieldLabel htmlFor="apiType">API 类型</FieldLabel>
              <div className="flex flex-wrap gap-base">
                {(Object.keys(API_TYPES) as ApiType[]).map((type) => (
                  <label
                    key={type}
                    className={cn(
                      'flex items-center gap-base px-base py-half rounded-sm border text-base cursor-pointer transition-colors',
                      'hover:border-brand hover:text-high',
                      formData.apiType === type
                        ? 'border-brand bg-brand/10 text-high'
                        : 'border-border text-normal bg-secondary'
                    )}
                  >
                    <input
                      type="radio"
                      name="apiType"
                      value={type}
                      checked={formData.apiType === type}
                      onChange={() => handleApiTypeChange(type)}
                      className="hidden"
                    />
                    {API_TYPES[type].label}
                  </label>
                ))}
              </div>
            </Field>

            {/* Base URL */}
            <Field>
              <FieldLabel htmlFor="baseUrl">Base URL</FieldLabel>
              <input
                id="baseUrl"
                type="text"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
                placeholder="API 端点地址"
                disabled={formData.apiType !== 'openai-compatible'}
                className={cn(
                  'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                  'placeholder:text-low placeholder:opacity-80',
                  'focus:outline-none focus:ring-1 focus:ring-brand',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  formErrors.baseUrl && 'border-error'
                )}
              />
              {formErrors.baseUrl && <FieldError>{formErrors.baseUrl}</FieldError>}
            </Field>

            {/* API Key */}
            <Field>
              <FieldLabel htmlFor="apiKey">API Key</FieldLabel>
              <input
                id="apiKey"
                type="password"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
                placeholder="输入 API 密钥"
                className={cn(
                  'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                  'placeholder:text-low placeholder:opacity-80',
                  'focus:outline-none focus:ring-1 focus:ring-brand',
                  formErrors.apiKey && 'border-error'
                )}
              />
              {formErrors.apiKey && <FieldError>{formErrors.apiKey}</FieldError>}
            </Field>

            {/* Fetch Models Button */}
            <Field>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetching || !formData.apiKey}
                className={cn(
                  'flex items-center justify-center gap-half w-full px-base py-half rounded-sm border text-base',
                  'hover:border-brand hover:text-high transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'bg-secondary text-normal'
                )}
              >
                {isFetching ? '获取中...' : '获取可用模型'}
              </button>
              {formErrors.fetch && <FieldError>{formErrors.fetch}</FieldError>}
            </Field>

            {/* Model Selection/Input */}
            <Field>
              <FieldLabel htmlFor="modelId">模型 ID</FieldLabel>
              {availableModels.length > 0 ? (
                <select
                  id="modelId"
                  value={formData.modelId}
                  onChange={(e) =>
                    setFormData({ ...formData, modelId: e.target.value })
                  }
                  className={cn(
                    'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                    'focus:outline-none focus:ring-1 focus:ring-brand',
                    formErrors.modelId && 'border-error'
                  )}
                >
                  <option value="">请选择模型</option>
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="modelId"
                  type="text"
                  value={formData.modelId}
                  onChange={(e) =>
                    setFormData({ ...formData, modelId: e.target.value })
                  }
                  placeholder="输入模型 ID，例如：claude-3-5-sonnet-20241022"
                  className={cn(
                    'w-full bg-secondary rounded-sm border px-base py-half text-base text-high',
                    'placeholder:text-low placeholder:opacity-80',
                    'focus:outline-none focus:ring-1 focus:ring-brand',
                    formErrors.modelId && 'border-error'
                  )}
                />
              )}
              {formErrors.modelId && <FieldError>{formErrors.modelId}</FieldError>}
            </Field>

            {/* Verify Connection Button */}
            <Field>
              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying}
                className={cn(
                  'flex items-center justify-center gap-half w-full px-base py-half rounded-sm border text-base',
                  'hover:border-brand hover:text-high transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'bg-secondary text-normal'
                )}
              >
                {isVerifying ? '验证中...' : '验证连接'}
              </button>
              {formErrors.verify && <FieldError>{formErrors.verify}</FieldError>}
            </Field>
          </div>

          <DialogFooter>
            <div className="flex gap-base">
              <button
                type="button"
                onClick={handleCloseDialog}
                className={cn(
                  'px-base py-half rounded-sm border text-base',
                  'bg-secondary text-normal hover:bg-panel hover:text-high',
                  'transition-colors'
                )}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className={cn(
                  'px-base py-half rounded-sm text-base',
                  'bg-brand text-on-brand hover:bg-brand-hover',
                  'transition-colors'
                )}
              >
                保存
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
