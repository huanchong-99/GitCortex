import React, { useState } from 'react';
import { Folder, GitBranch, AlertTriangle, Check, RefreshCw, XCircle } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { InputField } from '../../ui-new/primitives/InputField';
import { PrimaryButton } from '../../ui-new/primitives/PrimaryButton';
import type { ProjectConfig } from '../types';

interface Step0ProjectProps {
  config: ProjectConfig;
  onChange: (updates: Partial<ProjectConfig>) => void;
  errors: Record<string, string>;
}

export const Step0Project: React.FC<Step0ProjectProps> = ({
  config,
  onChange,
  errors,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const handleSelectFolder = () => {
    // TODO: Integrate with desktop file picker API
    // For Tauri: use @tauri-apps/plugin-dialog
    // For Electron: use dialog.showOpenDialog
    // For web: use File System Access API (window.showDirectoryPicker)
    // Currently, users can manually type or paste the path
    console.log('Folder selection - integrate with desktop API');
  };

  const checkGitStatus = async (path: string) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await fetch('/api/git/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      if (response.ok) {
        const gitStatus = await response.json();
        onChange({ gitStatus });
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setApiError(errorData.error || 'Failed to check git status');
      }
    } catch (error) {
      console.error('Failed to check git status:', error);
      setApiError('网络错误 - 无法连接到 Git API');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitGit = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const response = await fetch('/api/git/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: config.workingDirectory }),
      });

      if (response.ok) {
        await checkGitStatus(config.workingDirectory);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setApiError(errorData.error || 'Failed to initialize git repository');
      }
    } catch (error) {
      console.error('Failed to initialize git:', error);
      setApiError('网络错误 - 无法连接到 Git API');
    } finally {
      setIsLoading(false);
    }
  };

  const gitStatus = config.gitStatus;

  return (
    <div className="flex flex-col gap-base">
      <Field>
        <FieldLabel>选择项目工作目录</FieldLabel>
        <div className="flex gap-base">
          <InputField
            value={config.workingDirectory}
            onChange={(value) => {
              onChange({ workingDirectory: value });
              setApiError(null);
              if (value) {
                checkGitStatus(value);
              }
            }}
            placeholder="点击浏览选择文件夹..."
            className="flex-1"
          />
          <PrimaryButton variant="secondary" onClick={handleSelectFolder}>
            浏览
          </PrimaryButton>
        </div>
        {errors.workingDirectory && (
          <FieldError>{errors.workingDirectory}</FieldError>
        )}
        {apiError && (
          <div className="flex items-center gap-half text-sm text-error mt-half">
            <XCircle className="size-icon-xs" />
            <span>{apiError}</span>
          </div>
        )}
      </Field>

      {config.workingDirectory && (
        <div className="rounded-sm border border-border bg-secondary p-base">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-base">
              {isLoading ? (
                <RefreshCw className="size-icon-sm animate-spin text-low" />
              ) : gitStatus?.isGitRepo ? (
                <Check className="size-icon-sm text-success" />
              ) : (
                <AlertTriangle className="size-icon-sm text-warning" />
              )}
              <span className="text-base font-medium text-normal">
                {gitStatus?.isGitRepo
                  ? '检测到 Git 仓库'
                  : '未检测到 Git 仓库'}
              </span>
            </div>
            <button
              onClick={() => checkGitStatus(config.workingDirectory)}
              disabled={isLoading}
              className="text-low hover:text-normal disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="刷新 Git 状态"
            >
              <RefreshCw className="size-icon-sm" />
            </button>
          </div>

          {gitStatus?.isGitRepo && (
            <div className="mt-base flex flex-col gap-half">
              <div className="flex items-center gap-half text-sm text-low">
                <GitBranch className="size-icon-xs" />
                <span>
                  当前分支:{' '}
                  <span className="text-normal font-mono">
                    {gitStatus.currentBranch || 'N/A'}
                  </span>
                </span>
              </div>
              {gitStatus.remoteUrl && (
                <div className="text-sm text-low">
                  远程仓库:{' '}
                  <span className="font-mono text-normal">
                    {gitStatus.remoteUrl}
                  </span>
                </div>
              )}
              {gitStatus.isDirty && (
                <div className="text-sm text-warning">
                  有未提交的更改
                  {gitStatus.uncommittedChanges &&
                    ` (${gitStatus.uncommittedChanges} 个文件)`}
                </div>
              )}
            </div>
          )}

          {!gitStatus?.isGitRepo && config.workingDirectory && (
            <div className="mt-base">
              <PrimaryButton
                variant="tertiary"
                onClick={handleInitGit}
                disabled={isLoading}
              >
                初始化 Git 仓库
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
