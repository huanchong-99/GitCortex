import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Step2Tasks } from './Step2Tasks';
import type { TaskConfig } from '../types';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

describe('Step2Tasks', () => {
  const mockOnChange = vi.fn<(tasks: TaskConfig[]) => void>();

  const emptyTasks: TaskConfig[] = [];

  const initializedTasks: TaskConfig[] = [
    {
      id: 'task-1',
      name: '',
      description: '',
      branch: '',
      terminalCount: 1,
    },
    {
      id: 'task-2',
      name: '',
      description: '',
      branch: '',
      terminalCount: 1,
    },
  ];

  beforeEach(() => {
    mockOnChange.mockClear();
    void setTestLanguage();
  });

  it('should render task configuration UI', () => {
    renderWithI18n(
      <Step2Tasks
        config={initializedTasks}
        taskCount={2}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(
      screen.getByText(i18n.t('workflow:step2.header', { count: 2 }))
    ).toBeInTheDocument();
  });

  it('should initialize empty tasks when config length mismatches taskCount', () => {
    renderWithI18n(
      <Step2Tasks
        config={emptyTasks}
        taskCount={2}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should auto-generate branch name from task name', () => {
    const oneTask: TaskConfig[] = [
      {
        id: '1',
        name: '',
        description: '',
        branch: '',
        terminalCount: 1,
      },
    ];

    renderWithI18n(
      <Step2Tasks
        config={oneTask}
        taskCount={1}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const nameInput = screen.getByPlaceholderText(
      i18n.t('workflow:step2.namePlaceholder')
    );
    fireEvent.change(nameInput, { target: { value: 'User Login Feature' } });

    const calls = mockOnChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const updatedTasks = calls[0][0];
    expect(updatedTasks[0].branch).toBe('feat/user-login-feature');
  });

  it('should show terminal count selection', () => {
    const tasks: TaskConfig[] = [
      {
        id: '1',
        name: 'Task 1',
        description: 'Test',
        branch: 'feat/task-1',
        terminalCount: 1,
      },
    ];

    renderWithI18n(
      <Step2Tasks
        config={tasks}
        taskCount={1}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(
      screen.getByText(i18n.t('workflow:step2.terminalCountLabel'))
    ).toBeInTheDocument();
  });
});
