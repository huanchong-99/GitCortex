import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StepIndicator } from './StepIndicator';
import { WizardStep, WizardConfig, getDefaultWizardConfig } from './types';
import {
  validateStep0Project,
  validateStep1Basic,
  validateStep2Tasks,
  validateStep3Models,
  validateStep4Terminals,
  validateStep5Commands,
  validateStep6Advanced,
} from './validators';
import { useWizardNavigation } from './hooks/useWizardNavigation';
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
  onComplete: (config: WizardConfig) => void;
  onCancel: () => void;
  onError?: (error: Error) => void;
}

const stepValidators: Record<WizardStep, (config: WizardConfig) => Record<string, string>> = {
  [WizardStep.Project]: validateStep0Project,
  [WizardStep.Basic]: validateStep1Basic,
  [WizardStep.Tasks]: validateStep2Tasks,
  [WizardStep.Models]: validateStep3Models,
  [WizardStep.Terminals]: validateStep4Terminals,
  [WizardStep.Commands]: validateStep5Commands,
  [WizardStep.Advanced]: validateStep6Advanced,
};

export function WorkflowWizard({
  onComplete,
  onCancel,
  onError,
}: WorkflowWizardProps) {
  const [state, setState] = useState<{
    config: WizardConfig;
    isSubmitting: boolean;
    errors: Record<string, string>;
  }>({
    config: getDefaultWizardConfig(),
    isSubmitting: false,
    errors: {},
  });
  const navigation = useWizardNavigation();
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { config, isSubmitting, errors } = state;
  const { currentStep } = navigation;

  // Validation functions for each step
  const validateStep = (step: WizardStep, config: WizardConfig): Record<string, string> => {
    return stepValidators[step](config);
  };

  const handleNext = () => {
    const newErrors = validateStep(currentStep, config);

    if (Object.keys(newErrors).length > 0) {
      setState({ ...state, errors: newErrors });
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
    setState({ ...state, errors: {} });
  };

  const handleBack = () => {
    if (navigation.canGoPrevious()) {
      navigation.previous();
      setState({ ...state, errors: {} });
    }
  };

  const handleSubmit = async () => {
    const newErrors = validateStep(currentStep, config);

    if (Object.keys(newErrors).length > 0) {
      setState({ ...state, errors: newErrors });
      return;
    }

    setState({ ...state, isSubmitting: true, errors: {} });
    setSubmitError(null);

    try {
      await onComplete(config);
      // Reset submitting state after successful completion
      setState({ ...state, isSubmitting: false });
    } catch (error) {
      const errorObj =
        error instanceof Error
          ? error
          : new Error('???????????');
      onError?.(errorObj);
      setSubmitError(errorObj.message);
      setState({ ...state, isSubmitting: false });
    }
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleUpdateConfig = (updates: Partial<WizardConfig>) => {
    setState({
      ...state,
      config: {
        ...config,
        ...updates,
      },
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case WizardStep.Project:
        return (
          <Step0Project
            config={config.project}
            errors={errors}
            onChange={(updates) => handleUpdateConfig({ project: { ...config.project, ...updates } })}
          />
        );
      case WizardStep.Basic:
        return (
          <Step1Basic
            config={config.basic}
            errors={errors}
            onChange={(updates) => handleUpdateConfig({ basic: { ...config.basic, ...updates } })}
          />
        );
      case WizardStep.Tasks:
        return (
          <Step2Tasks
            config={config.tasks}
            taskCount={config.basic.taskCount}
            onChange={(tasks) => handleUpdateConfig({ tasks })}
            errors={errors}
          />
        );
      case WizardStep.Models:
        return (
          <Step3Models
            config={config}
            errors={errors}
            onUpdate={handleUpdateConfig}
          />
        );
      case WizardStep.Terminals:
        return (
          <Step4Terminals
            config={config}
            errors={errors}
            onUpdate={handleUpdateConfig}
          />
        );
      case WizardStep.Commands:
        return (
          <Step5Commands
            config={config}
            errors={errors}
            onUpdate={handleUpdateConfig}
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
      return isSubmitting ? '提交中...' : '创建工作流';
    }
    return '下一步';
  };

  const getBackButtonText = () => {
    if (currentStep === WizardStep.Project) {
      return '取消';
    }
    return '上一步';
  };

  const handlePrimaryButtonClick = () => {
    if (currentStep === WizardStep.Advanced) {
      handleSubmit();
    } else {
      handleNext();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto bg-panel text-high">
      <CardHeader>
        <CardTitle className="text-xl">创建工作流</CardTitle>
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
                取消
              </button>
            ) : null}

            {currentStep > WizardStep.Project && (
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
            )}
          </div>
        </div>

        {/* Error Display */}
        {(Object.keys(errors).length > 0 || submitError) && (
          <div className="mt-4 p-3 bg-error/10 border border-error rounded">
            {submitError ? (
              <div>
                <p className="text-sm text-error font-medium">提交失败</p>
                <p className="mt-2 text-sm text-error">{submitError}</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-error font-medium">请修正以下错误后继续:</p>
                <ul className="mt-2 text-sm text-error list-disc list-inside">
                  {Object.values(errors).map((error, index) => (
                    <li key={index}>{error}</li>
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
