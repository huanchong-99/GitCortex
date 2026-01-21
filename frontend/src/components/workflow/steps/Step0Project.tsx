import React, { useState } from 'react';
import { GitBranch, AlertTriangle, Check, RefreshCw, XCircle } from 'lucide-react';
import { Field, FieldLabel, FieldError } from '../../ui-new/primitives/Field';
import { InputField } from '../../ui-new/primitives/InputField';
import { PrimaryButton } from '../../ui-new/primitives/PrimaryButton';
import type { ProjectConfig, GitStatus } from '../types';
import { useTranslation } from 'react-i18next';
import { useErrorNotification } from '@/hooks/useErrorNotification';

interface Step0ProjectProps {
  config: ProjectConfig;
  onChange: (updates: Partial<ProjectConfig>) => void;
  errors: Record<string, string>;
  onError?: (error: Error) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isGitStatus = (value: unknown): value is GitStatus => {
  if (!isRecord(value)) return false;
  return (
    typeof value.isGitRepo === 'boolean' &&
    typeof value.isDirty === 'boolean' &&
    (value.currentBranch === undefined || typeof value.currentBranch === 'string') &&
    (value.remoteUrl === undefined || typeof value.remoteUrl === 'string') &&
    (value.uncommittedChanges === undefined || typeof value.uncommittedChanges === 'number')
  );
};

const getErrorMessage = (value: unknown, fallback: string): string => {
  if (isRecord(value) && typeof value.error === 'string' && value.error.trim()) {
    return value.error;
  }
  return fallback;
};

const parseJson = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

/**
 * Step 0: Selects the working directory and git status for the workflow.
 */
export const Step0Project: React.FC<Step0ProjectProps> = ({
  config,
  onChange,
  errors,
  onError,
}) => {
  const { t } = useTranslation('workflow');
  const { notifyError } = useErrorNotification({ onError, context: 'Step0Project' });
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

      const data = await parseJson(response);
      if (response.ok) {
        if (isGitStatus(data)) {
          onChange({ gitStatus: data });
        } else {
          setApiError(t('step0.errors.gitStatus'));
        }
      } else {
        setApiError(getErrorMessage(data, t('step0.errors.gitStatus')));
      }
    } catch (error) {
      notifyError(error, 'checkGitStatus');
      setApiError(t('step0.errors.gitNetwork'));
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

      const data = await parseJson(response);
      if (response.ok) {
        await checkGitStatus(config.workingDirectory);
      } else {
        setApiError(getErrorMessage(data, t('step0.errors.gitInit')));
      }
    } catch (error) {
      notifyError(error, 'initGit');
      setApiError(t('step0.errors.gitNetwork'));
    } finally {
      setIsLoading(false);
    }
  };

  const gitStatus = config.gitStatus;

  return (
    <div className="flex flex-col gap-base">
      <Field>
        <FieldLabel>{t('step0.fieldLabel')}</FieldLabel>
        <div className="flex gap-base">
          <InputField
            value={config.workingDirectory}
            onChange={(value) => {
              onChange({ workingDirectory: value });
              setApiError(null);
              if (value) {
                void checkGitStatus(value);
              }
            }}
            placeholder={t('step0.placeholder')}
            className="flex-1"
          />
          <PrimaryButton variant="secondary" onClick={handleSelectFolder}>
            {t('step0.browse')}
          </PrimaryButton>
        </div>
        {errors.workingDirectory && (
          <FieldError>{t(errors.workingDirectory)}</FieldError>
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
              ) : gitStatus.isGitRepo ? (
                <Check className="size-icon-sm text-success" />
              ) : (
                <AlertTriangle className="size-icon-sm text-warning" />
              )}
              <span className="text-base font-medium text-normal">
                {gitStatus.isGitRepo
                  ? t('step0.status.gitDetected')
                  : t('step0.status.gitNotDetected')}
              </span>
            </div>
            <button
              onClick={() => {
                void checkGitStatus(config.workingDirectory);
              }}
              disabled={isLoading}
              className="text-low hover:text-normal disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={t('step0.refreshLabel')}
            >
              <RefreshCw className="size-icon-sm" />
            </button>
          </div>

          {gitStatus.isGitRepo && (
            <div className="mt-base flex flex-col gap-half">
              <div className="flex items-center gap-half text-sm text-low">
                <GitBranch className="size-icon-xs" />
                <span>
                  {t('step0.branchLabel')}:
                  <span className="text-normal font-mono">
                    {gitStatus.currentBranch?.trim()
                      ? gitStatus.currentBranch
                      : t('step0.notAvailable')}
                  </span>
                </span>
              </div>
              {gitStatus.remoteUrl && (
                <div className="text-sm text-low">
                  {t('step0.remoteLabel')}:
                  <span className="font-mono text-normal">
                    {gitStatus.remoteUrl}
                  </span>
                </div>
              )}
              {gitStatus.isDirty && (
                <div className="text-sm text-warning">
                  {t('step0.dirtyLabel')}
                  {gitStatus.uncommittedChanges
                    ? ` (${t('step0.dirtyFiles', { count: gitStatus.uncommittedChanges })})`
                    : ''}
                </div>
              )}
                  
            </div>
          )}

          {!gitStatus.isGitRepo && config.workingDirectory && (
            <div className="mt-base">
              <PrimaryButton
                variant="tertiary"
                onClick={() => {
                  void handleInitGit();
                }}
                disabled={isLoading}
              >
                {t('step0.initGit')}
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
