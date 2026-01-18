import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Step6Advanced } from './Step6Advanced';
import type { WizardConfig } from '../types';

describe('Step6Advanced', () => {
  const mockOnUpdate = vi.fn();

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
      {
        id: 'model-2',
        displayName: 'GPT-4',
        apiType: 'openai',
        baseUrl: 'https://api.openai.com',
        apiKey: 'sk-test2',
        modelId: 'gpt-4',
        isVerified: true,
      },
    ],
  };

  beforeEach(() => {
    mockOnUpdate.mockClear();
  });

  describe('Orchestrator Configuration', () => {
    it('should render orchestrator model selection', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      expect(screen.getByText(/主 Agent 配置/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/主 Agent 配置/i)).toBeInTheDocument();
    });

    it('should display available models in orchestrator dropdown', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/主 Agent 配置/i);
      expect(select).toBeInTheDocument();

      const options = screen.getAllByText(/Claude 3\.5|GPT-4/);
      expect(options.length).toBeGreaterThan(0);
    });

    it('should update orchestrator model when selection changes', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/主 Agent 配置/i);
      fireEvent.change(select, { target: { value: 'model-1' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            orchestrator: expect.objectContaining({
              modelConfigId: 'model-1',
            }),
          }),
        })
      );
    });

    it('should show validation error for orchestrator model', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{ orchestratorModel: '请选择主 Agent 模型' }}
        />
      );

      expect(screen.getByText('请选择主 Agent 模型')).toBeInTheDocument();
    });
  });

  describe('Error Terminal Configuration', () => {
    it('should render error terminal toggle', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      expect(screen.getByLabelText(/启用错误恢复终端/i)).toBeInTheDocument();
    });

    it('should not show error terminal options when disabled', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      expect(screen.queryByLabelText(/错误恢复 CLI/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/错误恢复模型/i)).not.toBeInTheDocument();
    });

    it('should show error terminal options when enabled', () => {
      const configWithErrorTerminalEnabled = {
        ...defaultConfig,
        advanced: {
          ...defaultConfig.advanced,
          errorTerminal: { enabled: true },
        },
      };

      render(
        <Step6Advanced
          config={configWithErrorTerminalEnabled}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      expect(screen.getByLabelText(/错误恢复 CLI/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/错误恢复模型/i)).toBeInTheDocument();
    });

    it('should enable error terminal when checkbox is checked', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const checkbox = screen.getByLabelText(/启用错误恢复终端/i);
      fireEvent.click(checkbox);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            errorTerminal: expect.objectContaining({
              enabled: true,
            }),
          }),
        })
      );
    });

    it('should clear error terminal config when disabled', () => {
      const configWithErrorTerminalEnabled = {
        ...defaultConfig,
        advanced: {
          ...defaultConfig.advanced,
          errorTerminal: {
            enabled: true,
            cliTypeId: 'claude-code',
            modelConfigId: 'model-1',
          },
        },
      };

      render(
        <Step6Advanced
          config={configWithErrorTerminalEnabled}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const checkbox = screen.getByLabelText(/启用错误恢复终端/i);
      fireEvent.click(checkbox);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            errorTerminal: expect.objectContaining({
              enabled: false,
              cliTypeId: undefined,
              modelConfigId: undefined,
            }),
          }),
        })
      );
    });

    it('should update error terminal CLI selection', () => {
      const configWithErrorTerminalEnabled = {
        ...configWithModels,
        advanced: {
          ...configWithModels.advanced,
          errorTerminal: { enabled: true },
        },
      };

      render(
        <Step6Advanced
          config={configWithErrorTerminalEnabled}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/错误恢复 CLI/i);
      fireEvent.change(select, { target: { value: 'claude-code' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            errorTerminal: expect.objectContaining({
              cliTypeId: 'claude-code',
            }),
          }),
        })
      );
    });

    it('should update error terminal model selection', () => {
      const configWithErrorTerminalEnabled = {
        ...configWithModels,
        advanced: {
          ...configWithModels.advanced,
          errorTerminal: { enabled: true },
        },
      };

      render(
        <Step6Advanced
          config={configWithErrorTerminalEnabled}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/错误恢复模型/i);
      fireEvent.change(select, { target: { value: 'model-1' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            errorTerminal: expect.objectContaining({
              modelConfigId: 'model-1',
            }),
          }),
        })
      );
    });

    it('should show validation errors for error terminal fields', () => {
      const configWithErrorTerminalEnabled = {
        ...configWithModels,
        advanced: {
          ...configWithModels.advanced,
          errorTerminal: { enabled: true },
        },
      };

      render(
        <Step6Advanced
          config={configWithErrorTerminalEnabled}
          onUpdate={mockOnUpdate}
          errors={{
            errorTerminalCli: '请选择 CLI 类型',
            errorTerminalModel: '请选择模型',
          }}
        />
      );

      // Error messages appear in multiple places (option elements, FieldError components)
      // Check that error messages are present at least once (in FieldError)
      expect(screen.getAllByText('请选择 CLI 类型').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('请选择模型').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Merge Terminal Configuration', () => {
    it('should render merge terminal configuration', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      expect(screen.getByText(/合并终端配置/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/合并 CLI/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/合并模型/i)).toBeInTheDocument();
    });

    it('should update merge terminal CLI selection', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/合并 CLI/i);
      fireEvent.change(select, { target: { value: 'gemini-cli' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            mergeTerminal: expect.objectContaining({
              cliTypeId: 'gemini-cli',
            }),
          }),
        })
      );
    });

    it('should update merge terminal model selection', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/合并模型/i);
      fireEvent.change(select, { target: { value: 'model-2' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            mergeTerminal: expect.objectContaining({
              modelConfigId: 'model-2',
            }),
          }),
        })
      );
    });

    it('should have runTestsBeforeMerge checked by default', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const checkbox = screen.getByLabelText(/合并前运行测试/i);
      expect(checkbox).toBeChecked();
    });

    it('should have pauseOnConflict checked by default', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const checkbox = screen.getByLabelText(/冲突时暂停/i);
      expect(checkbox).toBeChecked();
    });

    it('should update runTestsBeforeMerge when checkbox is toggled', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const checkbox = screen.getByLabelText(/合并前运行测试/i);
      fireEvent.click(checkbox);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            mergeTerminal: expect.objectContaining({
              runTestsBeforeMerge: false,
            }),
          }),
        })
      );
    });

    it('should update pauseOnConflict when checkbox is toggled', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const checkbox = screen.getByLabelText(/冲突时暂停/i);
      fireEvent.click(checkbox);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            mergeTerminal: expect.objectContaining({
              pauseOnConflict: false,
            }),
          }),
        })
      );
    });

    it('should show validation errors for merge terminal fields', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{
            mergeTerminalCli: '请选择 CLI 类型',
            mergeTerminalModel: '请选择模型',
          }}
        />
      );

      // Error messages appear in multiple places (option elements, FieldError components)
      // Check that error messages are present at least once (in FieldError)
      expect(screen.getAllByText('请选择 CLI 类型').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('请选择模型').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Target Branch', () => {
    it('should render target branch input', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      expect(screen.getByLabelText(/目标分支/i)).toBeInTheDocument();
    });

    it('should display current target branch value', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const input = screen.getByLabelText(/目标分支/i);
      expect(input).toHaveValue('main');
    });

    it('should update target branch when input changes', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const input = screen.getByLabelText(/目标分支/i);
      fireEvent.change(input, { target: { value: 'develop' } });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          advanced: expect.objectContaining({
            targetBranch: 'develop',
          }),
        })
      );
    });

    it('should show validation error for target branch', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{ targetBranch: '请输入目标分支' }}
        />
      );

      expect(screen.getByText('请输入目标分支')).toBeInTheDocument();
    });
  });

  describe('Git Commit Format', () => {
    it('should render collapsible Git commit format section', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      expect(screen.getByText(/Git 提交格式/i)).toBeInTheDocument();
    });

    it('should display Git commit format template', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      // Expand the section
      const toggleButton = screen.getByText(/Git 提交格式/i).closest('button');
      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      expect(screen.getByText(/<type>/)).toBeInTheDocument();
      expect(screen.getByText(/<subject>/)).toBeInTheDocument();
      expect(screen.getByText(/Co-Authored-By:/)).toBeInTheDocument();
    });
  });

  describe('Helper Functions', () => {
    it('should use updateOrchestrator helper function', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/主 Agent 配置/i);
      fireEvent.change(select, { target: { value: 'model-1' } });

      const calls = mockOnUpdate.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toHaveProperty('advanced');
      expect(lastCall.advanced).toHaveProperty('orchestrator');
      expect(lastCall.advanced.orchestrator).toHaveProperty('modelConfigId', 'model-1');
    });

    it('should use updateErrorTerminal helper function', () => {
      const configWithErrorTerminalEnabled = {
        ...configWithModels,
        advanced: {
          ...configWithModels.advanced,
          errorTerminal: { enabled: true },
        },
      };

      render(
        <Step6Advanced
          config={configWithErrorTerminalEnabled}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/错误恢复 CLI/i);
      fireEvent.change(select, { target: { value: 'claude-code' } });

      const calls = mockOnUpdate.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toHaveProperty('advanced');
      expect(lastCall.advanced).toHaveProperty('errorTerminal');
      expect(lastCall.advanced.errorTerminal).toHaveProperty('cliTypeId', 'claude-code');
    });

    it('should use updateMergeTerminal helper function', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const select = screen.getByLabelText(/合并 CLI/i);
      fireEvent.change(select, { target: { value: 'codex' } });

      const calls = mockOnUpdate.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toHaveProperty('advanced');
      expect(lastCall.advanced).toHaveProperty('mergeTerminal');
      expect(lastCall.advanced.mergeTerminal).toHaveProperty('cliTypeId', 'codex');
    });
  });

  describe('Empty Models State', () => {
    it('should show placeholder options when no models available', () => {
      render(
        <Step6Advanced
          config={defaultConfig}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const orchestratorSelect = screen.getByLabelText(/主 Agent 配置/i);
      const mergeCliSelect = screen.getByLabelText(/合并 CLI/i);
      const mergeModelSelect = screen.getByLabelText(/合并模型/i);

      // Check for "请选择" placeholder text
      expect(orchestratorSelect).toHaveValue('');
      expect(mergeCliSelect).toHaveValue('');
      expect(mergeModelSelect).toHaveValue('');
    });
  });

  describe('CLI Type Options', () => {
    it('should display all CLI type options', () => {
      render(
        <Step6Advanced
          config={configWithModels}
          onUpdate={mockOnUpdate}
          errors={{}}
        />
      );

      const mergeCliSelect = screen.getByLabelText(/合并 CLI/i);
      fireEvent.change(mergeCliSelect, { target: { value: '' } });

      // Open the dropdown to see all options
      const options = screen.getAllByText(/Claude Code|Gemini CLI|Codex/);
      expect(options.length).toBeGreaterThanOrEqual(3);
    });
  });
});
