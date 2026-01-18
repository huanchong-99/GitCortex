import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Step0Project } from './Step0Project';
import type { ProjectConfig } from '../types';

describe('Step0Project', () => {
  const mockOnChange = vi.fn();

  const defaultConfig: ProjectConfig = {
    workingDirectory: '',
    gitStatus: {
      isGitRepo: false,
      isDirty: false,
    },
  };

  it('should render folder selection UI', () => {
    render(
      <Step0Project
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText('选择项目工作目录')).toBeInTheDocument();
    expect(screen.getByText('点击浏览选择文件夹...')).toBeInTheDocument();
    expect(screen.getByText('浏览')).toBeInTheDocument();
  });

  it('should show error when working directory is empty', () => {
    render(
      <Step0Project
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{ workingDirectory: '请选择工作目录' }}
      />
    );

    expect(screen.getByText('请选择工作目录')).toBeInTheDocument();
  });

  it('should display git repo status when directory is selected', () => {
    const configWithGit: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: true,
        currentBranch: 'main',
        isDirty: false,
      },
    };

    render(
      <Step0Project
        config={configWithGit}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText('检测到 Git 仓库')).toBeInTheDocument();
    expect(screen.getByText(/当前分支:/)).toBeInTheDocument();
  });

  it('should show init git option when not a git repo', () => {
    const configWithoutGit: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: false,
        isDirty: false,
      },
    };

    render(
      <Step0Project
        config={configWithoutGit}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText('未检测到 Git 仓库')).toBeInTheDocument();
    expect(screen.getByText('初始化 Git 仓库')).toBeInTheDocument();
  });
});
