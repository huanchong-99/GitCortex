import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step3Models } from './Step3Models';
import type { WizardConfig, ModelConfig } from '../types';

describe('Step3Models', () => {
  const mockOnUpdate = vi.fn();
  const mockConfirm = vi.fn();

  beforeEach(() => {
    mockOnUpdate.mockClear();
    (globalThis as any).confirm = mockConfirm;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const defaultConfig: WizardConfig = {
    project: {
      workingDirectory: '/test',
      gitStatus: { isGitRepo: true, isDirty: false },
    },
    basic: {
      name: 'Test Workflow',
      taskCount: 1,
      importFromKanban: false,
    },
    tasks: [],
    models: [],
    terminals: [],
    commands: {
      enabled: false,
      presetIds: [],
    },
    advanced: {
      orchestrator: { modelConfigId: '' },
      errorTerminal: { enabled: false },
      mergeTerminal: {
        cliTypeId: '',
        modelConfigId: '',
        runTestsBeforeMerge: true,
        pauseOnConflict: true,
      },
      targetBranch: 'main',
    },
  };

  it('should render empty state when no models configured', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    expect(screen.getByText('配置 AI 模型')).toBeInTheDocument();
    expect(screen.getByText(/还没有配置任何模型/i)).toBeInTheDocument();
  });

  it('should render add model button', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    expect(screen.getByRole('button', { name: /添加模型/i })).toBeInTheDocument();
  });

  it('should open dialog when add model button is clicked', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /^添加模型$/ });
    fireEvent.click(addButton);

    // Check that dialog content is visible (multiple "添加模型" texts expected)
    expect(screen.getAllByText(/添加模型/i)).toHaveLength(2);
    expect(screen.getByLabelText(/模型名称/i)).toBeInTheDocument();
  });

  it('should render list of configured models', () => {
    const configWithModels: WizardConfig = {
      ...defaultConfig,
      models: [
        {
          id: 'model-1',
          displayName: 'Claude 3.5',
          apiType: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test',
          modelId: 'claude-3-5-sonnet-20241022',
          isVerified: true,
        },
      ],
    };

    render(
      <Step3Models
        config={configWithModels}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    expect(screen.getByText('Claude 3.5')).toBeInTheDocument();
    // The model ID is rendered with "Anthropic · " prefix
    expect(screen.getByText(/claude-3-5-sonnet-20241022/)).toBeInTheDocument();
  });

  it('should display verified checkmark for verified models', () => {
    const configWithModels: WizardConfig = {
      ...defaultConfig,
      models: [
        {
          id: 'model-1',
          displayName: 'Claude 3.5',
          apiType: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test',
          modelId: 'claude-3-5-sonnet-20241022',
          isVerified: true,
        },
      ],
    };

    render(
      <Step3Models
        config={configWithModels}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    // Check for verified indicator (checkmark icon or similar)
    const verifiedBadge = screen.getByTestId(/verified-badge-model-1/i);
    expect(verifiedBadge).toBeInTheDocument();
  });

  it('should allow editing a model', () => {
    const configWithModels: WizardConfig = {
      ...defaultConfig,
      models: [
        {
          id: 'model-1',
          displayName: 'Claude 3.5',
          apiType: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test',
          modelId: 'claude-3-5-sonnet-20241022',
          isVerified: true,
        },
      ],
    };

    render(
      <Step3Models
        config={configWithModels}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const editButton = screen.getByRole('button', { name: /编辑.*Claude 3\.5/i });
    fireEvent.click(editButton);

    expect(screen.getByLabelText(/模型名称/i)).toHaveValue('Claude 3.5');
  });

  it('should allow deleting a model', () => {
    mockConfirm.mockReturnValue(true);

    const configWithModels: WizardConfig = {
      ...defaultConfig,
      models: [
        {
          id: 'model-1',
          displayName: 'Claude 3.5',
          apiType: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test',
          modelId: 'claude-3-5-sonnet-20241022',
          isVerified: true,
        },
      ],
    };

    render(
      <Step3Models
        config={configWithModels}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const deleteButton = screen.getByTitle('删除');
    fireEvent.click(deleteButton);

    expect(mockConfirm).toHaveBeenCalledWith('确定要删除这个模型配置吗？');
    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it('should auto-fill base URL based on API type selection', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /^添加模型$/ });
    fireEvent.click(addButton);

    // Click on Anthropic radio button label
    const anthropicLabel = screen.getByText('Anthropic');
    fireEvent.click(anthropicLabel);

    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    expect(baseUrlInput).toHaveValue('https://api.anthropic.com');
  });

  it('should allow manual base URL input for openai-compatible', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /^添加模型$/ });
    fireEvent.click(addButton);

    // Click on OpenAI Compatible radio button label
    const compatibleLabel = screen.getByText('OpenAI Compatible');
    fireEvent.click(compatibleLabel);

    const baseUrlInput = screen.getByLabelText(/Base URL/i);
    expect(baseUrlInput).toHaveValue('');
    expect(baseUrlInput).not.toBeDisabled();
  });

  it('should show validation errors for required fields', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /添加模型/i });
    fireEvent.click(addButton);

    const saveButton = screen.getByRole('button', { name: /保存/i });
    fireEvent.click(saveButton);

    expect(screen.getByText(/请输入模型名称/i)).toBeInTheDocument();
    expect(screen.getByText(/请输入 API Key/i)).toBeInTheDocument();
  });

  it('should handle API key input with password type', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /添加模型/i });
    fireEvent.click(addButton);

    const apiKeyInput = screen.getByLabelText(/API Key/i);
    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  it('should render all API type options', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /^添加模型$/ });
    fireEvent.click(addButton);

    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('OpenAI Compatible')).toBeInTheDocument();
  });

  it('should close dialog when cancel is clicked', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /添加模型/i });
    fireEvent.click(addButton);

    const cancelButton = screen.getByRole('button', { name: /取消/i });
    fireEvent.click(cancelButton);

    expect(screen.queryByLabelText(/模型名称/i)).not.toBeInTheDocument();
  });

  it('should display multiple models', () => {
    const configWithMultipleModels: WizardConfig = {
      ...defaultConfig,
      models: [
        {
          id: 'model-1',
          displayName: 'Claude 3.5',
          apiType: 'anthropic',
          baseUrl: 'https://api.anthropic.com',
          apiKey: 'sk-test',
          modelId: 'claude-3-5-sonnet-20241022',
          isVerified: true,
        },
        {
          id: 'model-2',
          displayName: 'GPT-4',
          apiType: 'openai',
          baseUrl: 'https://api.openai.com',
          apiKey: 'sk-test2',
          modelId: 'gpt-4',
          isVerified: false,
        },
      ],
    };

    render(
      <Step3Models
        config={configWithMultipleModels}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    expect(screen.getByText('Claude 3.5')).toBeInTheDocument();
    expect(screen.getByText('GPT-4')).toBeInTheDocument();
  });

  it('should show fetch models button', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /添加模型/i });
    fireEvent.click(addButton);

    expect(screen.getByRole('button', { name: /获取可用模型/i })).toBeInTheDocument();
  });

  it('should show verify connection button', () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /添加模型/i });
    fireEvent.click(addButton);

    expect(screen.getByRole('button', { name: /验证连接/i })).toBeInTheDocument();
  });

  it('should display model selection dropdown when models are fetched', async () => {
    render(
      <Step3Models
        config={defaultConfig}
        onUpdate={mockOnUpdate}
        errors={{}}
      />
    );

    const addButton = screen.getByRole('button', { name: /^添加模型$/ });
    fireEvent.click(addButton);

    // Fill in API Key
    fireEvent.change(screen.getByLabelText(/API Key/i), { target: { value: 'sk-test-key' } });

    // Click fetch models
    const fetchButton = screen.getByRole('button', { name: /获取可用模型/i });
    fireEvent.click(fetchButton);

    // After fetching, model selection should be available (dropdown with options)
    await waitFor(() => {
      const modelIdSelect = screen.getByLabelText(/模型 ID/i);
      expect(modelIdSelect).toBeInTheDocument();
      expect(modelIdSelect.tagName).toBe('SELECT');
    });
  });
});
