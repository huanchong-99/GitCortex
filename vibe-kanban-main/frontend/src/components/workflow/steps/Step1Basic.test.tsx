import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Step1Basic } from './Step1Basic';
import type { BasicConfig } from '../types';

describe('Step1Basic', () => {
  const mockOnChange = vi.fn();

  const defaultConfig: BasicConfig = {
    name: '',
    taskCount: 1,
    importFromKanban: false,
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('should render basic configuration form', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText('工作流名称')).toBeInTheDocument();
    expect(screen.getByText('本次启动几个并行任务？')).toBeInTheDocument();
  });

  it('should display error when name is empty', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{ name: '请输入工作流名称' }}
      />
    );

    expect(screen.getByText('请输入工作流名称')).toBeInTheDocument();
  });

  it('should allow selecting task count', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const twoTasksButton = screen.getByText('2 个任务');
    fireEvent.click(twoTasksButton);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ taskCount: 2 })
    );
  });

  it('should allow switching between import modes', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const importRadio = screen.getByText('从看板导入（选择已有任务卡片）');
    fireEvent.click(importRadio);

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ importFromKanban: true })
    );
  });

  it('should render description textarea', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText('工作流描述（可选）')).toBeInTheDocument();
  });

  it('should render task count selection buttons', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText('1 个任务')).toBeInTheDocument();
    expect(screen.getByText('2 个任务')).toBeInTheDocument();
    expect(screen.getByText('3 个任务')).toBeInTheDocument();
    expect(screen.getByText('4 个任务')).toBeInTheDocument();
  });

  it('should render custom task count input', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByPlaceholderText('5-10')).toBeInTheDocument();
  });

  it('should handle workflow name input change', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const nameInput = screen.getByPlaceholderText('例如：重构用户认证系统');
    fireEvent.change(nameInput, { target: { value: 'Test Workflow' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Workflow' })
    );
  });

  it('should handle description input change', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const descriptionInput = screen.getByPlaceholderText('简要描述工作流的目标和范围...');
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Test description' })
    );
  });

  it('should display error for taskCount', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{ taskCount: '请选择任务数量' }}
      />
    );

    expect(screen.getByText('请选择任务数量')).toBeInTheDocument();
  });

  it('should highlight selected task count button', () => {
    const configWithTwoTasks: BasicConfig = {
      ...defaultConfig,
      taskCount: 2,
    };

    render(
      <Step1Basic
        config={configWithTwoTasks}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const twoTasksButton = screen.getByText('2 个任务');
    expect(twoTasksButton.closest('button')).toHaveClass('border-brand');
  });

  it('should allow custom task count input', () => {
    render(
      <Step1Basic
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const customInput = screen.getByPlaceholderText('5-10');
    fireEvent.change(customInput, { target: { value: '7' } });

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ taskCount: 7 })
    );
  });
});
