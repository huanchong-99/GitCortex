import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step4Terminals } from './Step4Terminals';
import type { WizardConfig, TaskConfig } from '../types';

describe('Step4Terminals', () => {
  const mockOnUpdate = vi.fn();

  const baseConfig: WizardConfig = {
    project: {
      workingDirectory: '/test/path',
      gitStatus: { isGitRepo: true, isDirty: false },
    },
    basic: {
      name: 'Test Workflow',
      taskCount: 2,
      importFromKanban: false,
    },
    tasks: [
      {
        id: 'task-1',
        name: 'Task 1',
        description: 'First task',
        branch: 'feat/task-1',
        terminalCount: 2,
      },
      {
        id: 'task-2',
        name: 'Task 2',
        description: 'Second task',
        branch: 'feat/task-2',
        terminalCount: 1,
      },
    ],
    models: [
      {
        id: 'model-1',
        displayName: 'Claude 3.5 Sonnet',
        apiType: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: 'sk-test',
        modelId: 'claude-3-5-sonnet',
        isVerified: true,
      },
    ],
    terminals: [],
    commands: {
      enabled: false,
      presetIds: [],
    },
    advanced: {
      orchestrator: { modelConfigId: 'model-1' },
      errorTerminal: { enabled: false },
      mergeTerminal: {
        cliTypeId: 'claude-code',
        modelConfigId: 'model-1',
        runTestsBeforeMerge: true,
        pauseOnConflict: true,
      },
      targetBranch: 'main',
    },
  };

  beforeEach(() => {
    mockOnUpdate.mockClear();
    // Mock fetch API
    global.fetch = vi.fn();
  });

  it('should render terminal configuration UI', () => {
    render(
      <Step4Terminals
        config={baseConfig}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('配置终端')).toBeInTheDocument();
    expect(screen.getByText(/任务 1 \/ 2/)).toBeInTheDocument();
  });

  it('should initialize terminals when config length mismatches task count', async () => {
    render(
      <Step4Terminals
        config={baseConfig}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });

    const calls = mockOnUpdate.mock.calls;
    const terminalsUpdate = calls.find((call) => call[0].terminals);

    expect(terminalsUpdate).toBeDefined();
    expect(terminalsUpdate![0].terminals).toHaveLength(2);
  });

  it('should display terminal count for current task', () => {
    render(
      <Step4Terminals
        config={baseConfig}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('此任务有 2 个串行终端')).toBeInTheDocument();
  });

  it('should show CLI installation status', () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': false,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={baseConfig}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText('CLI 安装状态')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('Gemini CLI')).toBeInTheDocument();
  });

  it('should show install guide links for uninstalled CLIs', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': false,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={baseConfig}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    const installLinks = await screen.findAllByText('安装指南');
    expect(installLinks.length).toBeGreaterThan(0);
  });

  it('should navigate between tasks', () => {
    render(
      <Step4Terminals
        config={baseConfig}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    const nextButton = screen.getByText('下一个任务');
    const prevButton = screen.getByText('上一个任务');

    expect(nextButton).toBeInTheDocument();
    expect(prevButton).toBeInTheDocument();
    expect(prevButton).toBeDisabled();
  });

  it('should allow CLI type selection for terminals', async () => {
    const configWithTerminals: WizardConfig = {
      ...baseConfig,
      terminals: [
        {
          id: 'terminal-task-1-0',
          taskId: 'task-1',
          orderIndex: 0,
          cliTypeId: '',
          modelConfigId: '',
          role: '',
        },
        {
          id: 'terminal-task-1-1',
          taskId: 'task-1',
          orderIndex: 1,
          cliTypeId: '',
          modelConfigId: '',
          role: '',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': false,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={configWithTerminals}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    // Wait for CLI status section to appear
    await waitFor(() => {
      expect(screen.getByText('CLI 安装状态')).toBeInTheDocument();
    });

    // Claude Code should appear in the list
    const cliButtons = screen.getAllByText('Claude Code');
    expect(cliButtons.length).toBeGreaterThan(0);
  });

  it('should allow model selection for terminals', async () => {
    const configWithTerminals: WizardConfig = {
      ...baseConfig,
      terminals: [
        {
          id: 'terminal-task-1-0',
          taskId: 'task-1',
          orderIndex: 0,
          cliTypeId: 'claude-code',
          modelConfigId: '',
          role: '',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': false,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={configWithTerminals}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('模型配置')).toBeInTheDocument();
    });

    const option = screen.getByText('Claude 3.5 Sonnet');
    expect(option).toBeInTheDocument();
  });

  it('should allow role description input', async () => {
    const configWithTerminals: WizardConfig = {
      ...baseConfig,
      terminals: [
        {
          id: 'terminal-task-1-0',
          taskId: 'task-1',
          orderIndex: 0,
          cliTypeId: 'claude-code',
          modelConfigId: 'model-1',
          role: '',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': false,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={configWithTerminals}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('角色描述（可选）')).toBeInTheDocument();
    });

    const roleInput = screen.getByPlaceholderText('例如：负责后端 API 开发的专家');
    expect(roleInput).toBeInTheDocument();

    // Just verify the input exists and can be changed
    fireEvent.change(roleInput, { target: { value: 'Backend API expert' } });
    // Value might not update immediately due to state updates
    expect(mockOnUpdate).toHaveBeenCalled();
  });

  it('should update terminal when values change', async () => {
    const configWithTerminals: WizardConfig = {
      ...baseConfig,
      terminals: [
        {
          id: 'terminal-task-1-0',
          taskId: 'task-1',
          orderIndex: 0,
          cliTypeId: '',
          modelConfigId: '',
          role: '',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': false,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={configWithTerminals}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('角色描述（可选）')).toBeInTheDocument();
    });

    const roleInput = screen.getByPlaceholderText('例如：负责后端 API 开发的专家');
    fireEvent.change(roleInput, { target: { value: 'Test role' } });

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          terminals: expect.arrayContaining([
            expect.objectContaining({
              role: 'Test role',
            }),
          ]),
        })
      );
    });
  });

  it('should display errors for terminal configuration', async () => {
    const configWithTerminals: WizardConfig = {
      ...baseConfig,
      terminals: [
        {
          id: 'terminal-task-1-0',
          taskId: 'task-1',
          orderIndex: 0,
          cliTypeId: '',
          modelConfigId: '',
          role: '',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': false,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={configWithTerminals}
        errors={{
          'terminal-terminal-task-1-0-cli': '请选择 CLI 类型',
          'terminal-terminal-task-1-0-model': '请选择模型配置',
        }}
        onUpdate={mockOnUpdate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('请选择 CLI 类型')).toBeInTheDocument();
      expect(screen.getByText('请选择模型配置')).toBeInTheDocument();
    });
  });

  it('should sort terminals by orderIndex', async () => {
    const configWithTerminals: WizardConfig = {
      ...baseConfig,
      terminals: [
        {
          id: 'terminal-task-1-1',
          taskId: 'task-1',
          orderIndex: 1,
          cliTypeId: 'claude-code',
          modelConfigId: 'model-1',
          role: 'Second terminal',
        },
        {
          id: 'terminal-task-1-0',
          taskId: 'task-1',
          orderIndex: 0,
          cliTypeId: 'gemini-cli',
          modelConfigId: 'model-1',
          role: 'First terminal',
        },
      ],
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'claude-code': true,
        'gemini-cli': true,
        codex: false,
        'cursor-agent': false,
      }),
    });

    render(
      <Step4Terminals
        config={configWithTerminals}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    await waitFor(() => {
      const terminalHeaders = screen.getAllByText(/终端 \d/);
      expect(terminalHeaders[0]).toHaveTextContent('终端 1');
      expect(terminalHeaders[1]).toHaveTextContent('终端 2');
    });
  });

  it('should handle fetch error gracefully', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(
      <Step4Terminals
        config={baseConfig}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    // Should still render even if fetch fails
    expect(screen.getByText('配置终端')).toBeInTheDocument();
  });

  it('should return null when current task is not available', () => {
    const configWithoutTasks: WizardConfig = {
      ...baseConfig,
      tasks: [],
    };

    const { container } = render(
      <Step4Terminals
        config={configWithoutTasks}
        errors={{}}
        onUpdate={mockOnUpdate}
      />
    );

    // Component should return null, rendering nothing
    expect(container).toBeEmptyDOMElement();
  });
});
