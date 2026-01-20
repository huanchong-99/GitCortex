import { useCallback, useMemo, useState } from 'react';
import { WIZARD_STEPS, WizardStep } from '../types';

const STEP_ORDER = WIZARD_STEPS.map((step) => step.step);

export interface UseWizardNavigationOptions {
  initialStep?: WizardStep;
}

export interface UseWizardNavigationReturn {
  currentStep: WizardStep;
  stepIndex: number;
  totalSteps: number;
  canGoNext: () => boolean;
  canGoPrevious: () => boolean;
  next: () => void;
  previous: () => void;
  goToStep: (step: WizardStep) => void;
}

/**
 * Provides step navigation state and helpers for the workflow wizard.
 */
export function useWizardNavigation(
  options: UseWizardNavigationOptions = {}
): UseWizardNavigationReturn {
  const { initialStep = WizardStep.Project } = options;
  const normalizedInitialStep = STEP_ORDER.includes(initialStep)
    ? initialStep
    : WizardStep.Project;

  const [currentStep, setCurrentStep] = useState<WizardStep>(normalizedInitialStep);

  const stepIndex = useMemo(
    () => STEP_ORDER.indexOf(currentStep),
    [currentStep]
  );

  const canGoNext = useCallback(() => {
    return stepIndex < STEP_ORDER.length - 1;
  }, [stepIndex]);

  const canGoPrevious = useCallback(() => {
    return stepIndex > 0;
  }, [stepIndex]);

  const next = useCallback(() => {
    if (canGoNext()) {
      setCurrentStep(STEP_ORDER[stepIndex + 1]);
    }
  }, [canGoNext, stepIndex]);

  const previous = useCallback(() => {
    if (canGoPrevious()) {
      setCurrentStep(STEP_ORDER[stepIndex - 1]);
    }
  }, [canGoPrevious, stepIndex]);

  const goToStep = useCallback((step: WizardStep) => {
    if (STEP_ORDER.includes(step)) {
      setCurrentStep(step);
    }
  }, []);

  return {
    currentStep,
    stepIndex,
    totalSteps: STEP_ORDER.length,
    canGoNext,
    canGoPrevious,
    next,
    previous,
    goToStep,
  };
}
