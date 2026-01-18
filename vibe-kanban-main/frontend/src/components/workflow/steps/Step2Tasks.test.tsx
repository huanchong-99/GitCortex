import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step2Tasks } from './Step2Tasks';
import type { TaskConfig } from '../types';

describe('Step2Tasks', () => {
  const mockOnChange = vi.fn();

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
  });

  it('should render task configuration UI', () => {
    render(
      <Step2Tasks
        config={initializedTasks}
        taskCount={2}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText(/配置 2 个并行任务/)).toBeInTheDocument();
  });

  it('should initialize empty tasks when config length mismatches taskCount', () => {
    render(
      <Step2Tasks
        config={emptyTasks}
        taskCount={2}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    // Should trigger onChange to initialize tasks
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should auto-generate branch name from task name', () => {
    const oneTask: TaskConfig[] = [{
      id: '1',
      name: '',
      description: '',
      branch: '',
      terminalCount: 1,
    }];

    render(
      <Step2Tasks
        config={oneTask}
        taskCount={1}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const nameInput = screen.getByPlaceholderText('例如：登录功能');
    fireEvent.change(nameInput, { target: { value: 'User Login Feature' } });

    // Should auto-generate branch name
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        0: expect.objectContaining({ branch: 'feat/user-login-feature' })
      })
    );
  });

  it('should show terminal count selection', () => {
    const tasks: TaskConfig[] = [{
      id: '1',
      name: 'Task 1',
      description: 'Test',
      branch: 'feat/task-1',
      terminalCount: 1,
    }];

    render(
      <Step2Tasks
        config={tasks}
        taskCount={1}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText('此任务需要几个终端串行执行？')).toBeInTheDocument();
  });
});
