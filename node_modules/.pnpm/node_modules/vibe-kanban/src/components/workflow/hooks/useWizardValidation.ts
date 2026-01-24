import { useCallback, useMemo, useState } from 'react';
import type { WizardConfig } from '../types';
import { WizardStep } from '../types';
import { validateWizardStep } from '../validators';

export interface UseWizardValidationReturn {
  errors: Record<string, string>;
  hasErrors: boolean;
  validate: (config: WizardConfig) => Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
  clearErrors: () => void;
}

/**
 * Tracks per-step validation errors and exposes validation helpers.
 */
export function useWizardValidation(currentStep: WizardStep): UseWizardValidationReturn {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(
    (config: WizardConfig): Record<string, string> => {
      const stepErrors = validateWizardStep(currentStep, config);
      setErrors(stepErrors);
      return stepErrors;
    },
    [currentStep]
  );

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);

  return {
    errors,
    hasErrors,
    validate,
    setErrors,
    clearErrors,
  };
}
