import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { StepIndicator } from './StepIndicator';
import { WizardStep, WizardState, WizardConfig, getDefaultWizardConfig } from './types';
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
}

export function WorkflowWizard({ onComplete, onCancel }: WorkflowWizardProps) {
  const [state, setState] = useState<WizardState>({
    currentStep: WizardStep.Project,
    config: getDefaultWizardConfig(),
    isSubmitting: false,
    errors: {},
  });
  const [completedSteps, setCompletedSteps] = useState<WizardStep[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { currentStep, config, isSubmitting, errors } = state;

  // Validation functions for each step
  const validateStep = (step: WizardStep, config: WizardConfig): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case WizardStep.Project:
        if (!config.project.workingDirectory?.trim()) {
          newErrors.workingDirectory = '请选择项目文件夹';
        }
        break;

      case WizardStep.Basic:
        if (!config.basic.name?.trim()) {
          newErrors.name = '请输入工作流名称';
        }
        if (config.basic.taskCount < 1) {
          newErrors.taskCount = '任务数量必须至少为 1';
        }
        break;

      case WizardStep.Tasks:
        if (!config.tasks || config.tasks.length === 0) {
          newErrors.tasks = '请至少添加一个任务';
        } else {
          config.tasks.forEach((task, index) => {
            if (!task.name?.trim()) {
              newErrors[`task-${index}-name`] = '请输入任务名称';
            }
            if (!task.description?.trim()) {
              newErrors[`task-${index}-description`] = '请输入任务描述';
            }
          });
        }
        break;

      case WizardStep.Models:
        if (config.models.length === 0) {
          newErrors.models = '请至少添加一个模型配置';
        }
        break;

      case WizardStep.Terminals:
        if (!config.terminals || config.terminals.length === 0) {
          newErrors.terminals = '请至少添加一个终端配置';
        } else {
          config.terminals.forEach((terminal, index) => {
            if (!terminal.cliTypeId?.trim()) {
              newErrors[`terminal-${index}-cli`] = '请选择 CLI 类型';
            }
            if (!terminal.modelConfigId?.trim()) {
              newErrors[`terminal-${index}-model`] = '请选择模型配置';
            }
          });
        }
        break;

      case WizardStep.Commands:
        // Commands step is optional, no validation required
        break;

      case WizardStep.Advanced:
        if (!config.advanced.orchestrator.modelConfigId?.trim()) {
          newErrors.orchestratorModel = '请选择主 Agent 模型';
        }
        if (!config.advanced.mergeTerminal.cliTypeId?.trim()) {
          newErrors.mergeCli = '请选择合并终端 CLI 类型';
        }
        if (!config.advanced.mergeTerminal.modelConfigId?.trim()) {
          newErrors.mergeModel = '请选择合并终端模型';
        }
        break;
    }

    return newErrors;
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

    if (currentStep < WizardStep.Advanced) {
      setState({
        ...state,
        currentStep: currentStep + 1,
        errors: {},
      });
    }
  };

  const handleBack = () => {
    if (currentStep > WizardStep.Project) {
      setState({
        ...state,
        currentStep: currentStep - 1,
        errors: {},
      });
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
      console.error('Failed to create workflow:', error);
      const errorMessage = error instanceof Error ? error.message : '创建工作流失败，请重试';
      setSubmitError(errorMessage);
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
    const stepProps = {
      config,
      errors,
      onUpdate: handleUpdateConfig,
    };

    switch (currentStep) {
      case WizardStep.Project:
        return <Step0Project {...stepProps} />;
      case WizardStep.Basic:
        return <Step1Basic {...stepProps} />;
      case WizardStep.Tasks:
        return <Step2Tasks {...stepProps} />;
      case WizardStep.Models:
        return <Step3Models {...stepProps} />;
      case WizardStep.Terminals:
        return <Step4Terminals {...stepProps} />;
      case WizardStep.Commands:
        return <Step5Commands {...stepProps} />;
      case WizardStep.Advanced:
        return <Step6Advanced {...stepProps} />;
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
