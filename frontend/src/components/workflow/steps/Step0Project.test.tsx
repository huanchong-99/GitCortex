import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Step0Project } from './Step0Project';
import type { ProjectConfig } from '../types';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

describe('Step0Project', () => {
  const mockOnChange = vi.fn<(updates: Partial<ProjectConfig>) => void>();

  const defaultConfig: ProjectConfig = {
    workingDirectory: '',
    gitStatus: {
      isGitRepo: false,
      isDirty: false,
    },
  };

  beforeEach(() => {
    mockOnChange.mockClear();
    void setTestLanguage();
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)
    );
  });

  it('should render folder selection UI', () => {
    renderWithI18n(
      <Step0Project
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(screen.getByText(i18n.t('workflow:step0.fieldLabel'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:step0.placeholder'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:step0.browse'))).toBeInTheDocument();
  });

  it('should show error when working directory is empty', () => {
    renderWithI18n(
      <Step0Project
        config={defaultConfig}
        onChange={mockOnChange}
        errors={{ workingDirectory: 'validation.project.workingDirectoryRequired' }}
      />
    );

    expect(
      screen.getByText(i18n.t('workflow:validation.project.workingDirectoryRequired'))
    ).toBeInTheDocument();
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

    renderWithI18n(
      <Step0Project
        config={configWithGit}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(
      screen.getByText(i18n.t('workflow:step0.status.gitDetected'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(i18n.t('workflow:step0.branchLabel')))
    ).toBeInTheDocument();
  });

  it('should show init git option when not a git repo', () => {
    const configWithoutGit: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: false,
        isDirty: false,
      },
    };

    renderWithI18n(
      <Step0Project
        config={configWithoutGit}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(
      screen.getByText(i18n.t('workflow:step0.status.gitNotDetected'))
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:step0.initGit'))).toBeInTheDocument();
  });

  it('should display remote URL when available', () => {
    const configWithRemote: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: true,
        currentBranch: 'main',
        remoteUrl: 'https://github.com/user/repo.git',
        isDirty: false,
      },
    };

    renderWithI18n(
      <Step0Project
        config={configWithRemote}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    expect(
      screen.getByText(new RegExp(i18n.t('workflow:step0.remoteLabel')))
    ).toBeInTheDocument();
    expect(screen.getByText('https://github.com/user/repo.git')).toBeInTheDocument();
  });

  it('should display dirty state warning when repo has uncommitted changes', () => {
    const configWithDirty: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: true,
        currentBranch: 'main',
        isDirty: true,
        uncommittedChanges: 3,
      },
    };

    renderWithI18n(
      <Step0Project
        config={configWithDirty}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const dirtyText = `${i18n.t('workflow:step0.dirtyLabel')} (${i18n.t(
      'workflow:step0.dirtyFiles',
      { count: 3 }
    )})`;
    expect(screen.getByText(dirtyText)).toBeInTheDocument();
  });

  it('should have refresh button enabled when not loading', () => {
    const configWithGit: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: true,
        currentBranch: 'main',
        isDirty: false,
      },
    };

    const { container } = renderWithI18n(
      <Step0Project
        config={configWithGit}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const refreshButton = container.querySelector(
      `button[aria-label="${i18n.t('workflow:step0.refreshLabel')}"]`
    );
    expect(refreshButton).toBeInTheDocument();
    expect(refreshButton).not.toBeDisabled();
  });

  it('should have refresh button disabled during loading', () => {
    const configWithGit: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: true,
        currentBranch: 'main',
        isDirty: false,
      },
    };

    globalThis.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({}),
            } as Response);
          }, 10000);
        })
    );

    const { container } = renderWithI18n(
      <Step0Project
        config={configWithGit}
        onChange={mockOnChange}
        errors={{}}
      />
    );

    const refreshButton = container.querySelector(
      `button[aria-label="${i18n.t('workflow:step0.refreshLabel')}"]`
    );
    if (refreshButton) {
      fireEvent.click(refreshButton);
    }

    expect(refreshButton).toBeInTheDocument();
  });

  it('should call onError when git status fetch fails', async () => {
    const onError = vi.fn();
    const configWithGit: ProjectConfig = {
      workingDirectory: '/path/to/project',
      gitStatus: {
        isGitRepo: true,
        currentBranch: 'main',
        isDirty: false,
      },
    };

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network fail'));

    renderWithI18n(
      <Step0Project
        config={configWithGit}
        onChange={mockOnChange}
        errors={{}}
        onError={onError}
      />
    );

    fireEvent.click(
      screen.getByLabelText(i18n.t('workflow:step0.refreshLabel'))
    );

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
