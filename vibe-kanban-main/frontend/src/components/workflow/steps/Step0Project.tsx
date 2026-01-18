import React, { useState } from 'react';
import { Folder, GitBranch, AlertTriangle, Check, RefreshCw } from 'lucide-react';
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

  const handleSelectFolder = () => {
    // In web environment, this would use File System Access API or similar
    // For now, the user can manually type the path
    // This is a placeholder for future file picker implementation
    console.log('Folder selection triggered');
  };

  const checkGitStatus = async (path: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/git/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });

      if (response.ok) {
        const gitStatus = await response.json();
        onChange({ gitStatus });
      }
    } catch (error) {
      console.error('Failed to check git status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitGit = async () => {
    try {
      const response = await fetch('/api/git/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: config.workingDirectory }),
      });

      if (response.ok) {
        await checkGitStatus(config.workingDirectory);
      }
    } catch (error) {
      console.error('Failed to initialize git:', error);
    }
  };

  return (
    <div className="flex flex-col gap-base">
      <Field>
        <FieldLabel>选择项目工作目录</FieldLabel>
        <div className="flex gap-base">
          <InputField
            value={config.workingDirectory}
            onChange={(value) => {
              onChange({ workingDirectory: value });
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
      </Field>

      {config.workingDirectory && (
        <div className="rounded-sm border border-border bg-secondary p-base">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-base">
              {isLoading ? (
                <RefreshCw className="size-icon-sm animate-spin text-low" />
              ) : config.gitStatus.isGitRepo ? (
                <Check className="size-icon-sm text-success" />
              ) : (
                <AlertTriangle className="size-icon-sm text-warning" />
              )}
              <span className="text-base font-medium text-normal">
                {config.gitStatus.isGitRepo
                  ? '检测到 Git 仓库'
                  : '未检测到 Git 仓库'}
              </span>
            </div>
            {!isLoading && config.workingDirectory && (
              <button
                onClick={() => checkGitStatus(config.workingDirectory)}
                className="text-low hover:text-normal"
              >
                <RefreshCw className="size-icon-sm" />
              </button>
            )}
          </div>

          {config.gitStatus.isGitRepo && (
            <div className="mt-base flex flex-col gap-half">
              <div className="flex items-center gap-half text-sm text-low">
                <GitBranch className="size-icon-xs" />
                <span>
                  当前分支:{' '}
                  <span className="text-normal font-mono">
                    {config.gitStatus.currentBranch || 'N/A'}
                  </span>
                </span>
              </div>
              {config.gitStatus.remoteUrl && (
                <div className="text-sm text-low">
                  远程仓库:{' '}
                  <span className="font-mono text-normal">
                    {config.gitStatus.remoteUrl}
                  </span>
                </div>
              )}
              {config.gitStatus.isDirty && (
                <div className="text-sm text-warning">
                  有未提交的更改
                  {config.gitStatus.uncommittedChanges &&
                    ` (${config.gitStatus.uncommittedChanges} 个文件)`}
                </div>
              )}
            </div>
          )}

          {!config.gitStatus.isGitRepo && config.workingDirectory && (
            <div className="mt-base">
              <PrimaryButton variant="tertiary" onClick={handleInitGit}>
                初始化 Git 仓库
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
