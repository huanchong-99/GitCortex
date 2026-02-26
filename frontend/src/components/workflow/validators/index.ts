import type { WizardConfig } from '../types';
import { WizardStep } from '../types';

// Import validators for internal use only
import { validateStep0Project } from './step0Project';
import { validateStep1Basic } from './step1Basic';
import { validateStep2Tasks } from './step2Tasks';
import { validateStep3Models } from './step3Models';
import { validateStep4Terminals } from './step4Terminals';
import { validateStep5Commands } from './step5Commands';
import { validateStep6Advanced } from './step6Advanced';

const stepValidators: Record<WizardStep, (config: WizardConfig) => Record<string, string>> = {
  [WizardStep.Project]: validateStep0Project,
  [WizardStep.Basic]: validateStep1Basic,
  [WizardStep.Tasks]: validateStep2Tasks,
  [WizardStep.Models]: validateStep3Models,
  [WizardStep.Terminals]: validateStep4Terminals,
  [WizardStep.Commands]: validateStep5Commands,
  [WizardStep.Advanced]: validateStep6Advanced,
};

/**
 * Runs the appropriate validator for the current wizard step.
 */
export function validateWizardStep(
  step: WizardStep,
  config: WizardConfig
): Record<string, string> {
  return stepValidators[step](config);
}

// Re-export validators using export...from syntax
export { validateStep0Project } from './step0Project';
export { validateStep1Basic } from './step1Basic';
export { validateStep2Tasks } from './step2Tasks';
export { validateStep3Models } from './step3Models';
export { validateStep4Terminals } from './step4Terminals';
export { validateStep5Commands } from './step5Commands';
export { validateStep6Advanced } from './step6Advanced';
