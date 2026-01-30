import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StepIndicator } from './StepIndicator';
import { WizardStep, WizardConfig, getDefaultWizardConfig } from './types';
import { useWizardNavigation } from './hooks/useWizardNavigation';
import { useWizardValidation } from './hooks/useWizardValidation';
import { useTranslation } from 'react-i18next';
import {
  Step0Project,
  Step1Basic,
  Step2Tasks,
  Step3Models,
  Step4Terminals,
  Step5Commands,
  Step6Advanced,
} from './steps';

interface WorkflowWizardProps {
  onComplete: (config: WizardConfig) => void | Promise<void>;
  onCancel: () => void;
  onError?: (error: Error) => void;
}

/**
 * Renders the multi-step workflow wizard with navigation and validation.
 */
export function WorkflowWizard({
  onComplete,
  onCancel,
  onError,
}: WorkflowWizardProps) {
  const [state, setState] = useState<{
    config: WizardConfig;
    isSubmitting: boolean;
  }>({
    config: getDefaultWizardConfig(),
    isSubmitting: false,
  });
  const navigation = useWizardNavigation();
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { config, isSubmitting } = state;
  const { currentStep } = navigation;
  const validation = useWizardValidation(currentStep);
  const { errors } = validation;
  const { t } = useTranslation('workflow');

  const handleNext = () => {
    const newErrors = validation.validate(config);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    // Mark current step as completed and move to next step
    const newCompletedSteps = [...completedSteps];
    if (!newCompletedSteps.includes(currentStep)) {
      newCompletedSteps.push(currentStep);
    }
    setCompletedSteps(newCompletedSteps);

    if (navigation.canGoNext()) {
      navigation.next();
    }
    validation.clearErrors();
  };

  const handleBack = () => {
    if (navigation.canGoPrevious()) {
      navigation.previous();
      validation.clearErrors();
    }
  };

  const handleSubmit = async () => {
    const newErrors = validation.validate(config);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

    setState({ ...state, isSubmitting: true });
    setSubmitError(null);

    try {
      await Promise.resolve(onComplete(config));
      // Reset submitting state after successful completion
      setState({ ...state, isSubmitting: false });
    } catch (error) {
      const errorObj =
        error instanceof Error
          ? error
          : new Error(t('wizard.errors.submitUnknown'));
      onError?.(errorObj);
      setSubmitError(errorObj.message);
      setState({ ...state, isSubmitting: false });
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleUpdateConfig = (updates: Partial<WizardConfig>) => {
    setState((prevState) => ({
      ...prevState,
      config: {
        ...prevState.config,
        ...updates,
      },
    }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case WizardStep.Project:
        return (
          <Step0Project
            config={config.project}
            errors={errors}
            onError={onError}
            onChange={(updates) => {
              setState((prevState) => ({
                ...prevState,
                config: {
                  ...prevState.config,
                  project: { ...prevState.config.project, ...updates },
                },
              }));
            }}
          />
        );
      case WizardStep.Basic:
        return (
          <Step1Basic
            config={config.basic}
            errors={errors}
            onChange={(updates) => {
              handleUpdateConfig({ basic: { ...config.basic, ...updates } });
            }}
          />
        );
      case WizardStep.Tasks:
        return (
          <Step2Tasks
            config={config.tasks}
            taskCount={config.basic.taskCount}
            onChange={(tasks) => {
              handleUpdateConfig({ tasks });
            }}
            errors={errors}
          />
        );
      case WizardStep.Models:
        return (
          <Step3Models
            config={config}
            onUpdate={handleUpdateConfig}
          />
        );
      case WizardStep.Terminals:
        return (
          <Step4Terminals
            config={config}
            errors={errors}
            onUpdate={handleUpdateConfig}
            onError={onError}
          />
        );
      case WizardStep.Commands:
        return (
          <Step5Commands
            config={config.commands}
            errors={errors}
            onUpdate={(updates) => {
              handleUpdateConfig({ commands: { ...config.commands, ...updates } });
            }}
            onError={onError}
          />
        );
      case WizardStep.Advanced:
        return (
          <Step6Advanced
            config={config}
            errors={errors}
            onUpdate={handleUpdateConfig}
          />
        );
      default:
        return null;
    }
  };

  const getButtonText = () => {
    if (currentStep === WizardStep.Advanced) {
      return isSubmitting
        ? t('wizard.buttons.submitting')
        : t('wizard.buttons.submit');
    }
    return t('wizard.buttons.next');
  };

  const getBackButtonText = () => {
    if (currentStep === WizardStep.Project) {
      return t('wizard.buttons.cancel');
    }
    return t('wizard.buttons.back');
  };

  const handlePrimaryButtonClick = () => {
    if (currentStep === WizardStep.Advanced) {
      void handleSubmit();
    } else {
      handleNext();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-panel text-high">
      <CardHeader>
        <CardTitle className="text-xl">{t('wizard.title')}</CardTitle>
      </CardHeader>
      <CardContent className="px-base">
        <StepIndicator currentStep={currentStep} completedSteps={completedSteps} />

        <div className="min-h-[400px] mb-6">
          {renderStep()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-border">
          <div>
            {currentStep > WizardStep.Project ? (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className={cn(
                  'px-4 py-2 rounded border text-sm',
                  'bg-secondary text-low hover:text-normal',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {getBackButtonText()}
              </button>
            ) : null}
          </div>

          <div className="flex gap-3">
            {currentStep === WizardStep.Project ? (
              <button
                onClick={handleCancel}
                className={cn(
                  'px-4 py-2 rounded border text-sm',
                  'bg-secondary text-low hover:text-normal'
                )}
              >
                {t('wizard.buttons.cancel')}
              </button>
            ) : null}

            <button
              onClick={handlePrimaryButtonClick}
              disabled={isSubmitting}
              className={cn(
                'px-4 py-2 rounded border text-sm',
                'bg-brand text-white hover:opacity-90',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {getButtonText()}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {(Object.keys(errors).length > 0 || submitError) && (
          <div className="mt-4 p-3 bg-error/10 border border-error rounded">
            {submitError ? (
              <div>
                <p className="text-sm text-error font-medium">{t('wizard.errors.submitFailedTitle')}</p>
                <p className="mt-2 text-sm text-error">{submitError}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-error font-medium">{t('wizard.errors.validationTitle')}</p>
                <ul className="mt-2 text-sm text-error list-disc list-inside">
                  {Object.values(errors).map((error, index) => (
                    <li key={index}>{t(error)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
