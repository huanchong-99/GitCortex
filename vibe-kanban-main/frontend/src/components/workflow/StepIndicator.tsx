import { cn } from '@/lib/utils';
import { WizardStep, WIZARD_STEPS } from './types';
import { Check } from 'lucide-react';

interface Props {
  currentStep: WizardStep;
  completedSteps: WizardStep[];
}

export function StepIndicator({ currentStep, completedSteps }: Props) {
  return (
    <div className="flex items-center justify-between w-full mb-8">
      {WIZARD_STEPS.map((stepInfo, index) => {
        const isCompleted = completedSteps.includes(stepInfo.step);
        const isCurrent = currentStep === stepInfo.step;
        const isPast = stepInfo.step < currentStep;

        return (
          <div key={stepInfo.step} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                  isCompleted && 'bg-brand border-brand text-white',
                  isCurrent && !isCompleted && 'border-brand text-brand bg-brand/10',
                  !isCurrent && !isCompleted && 'border-muted text-low bg-secondary'
                )}
              >
                {/* Display step number (1-based) or checkmark if completed */}
                {isCompleted ? <Check className="w-5 h-5" /> : index + 1}
              </div>
              <span
                className={cn(
                  'text-xs mt-2 text-center max-w-[80px]',
                  isCurrent ? 'text-normal font-medium' : 'text-low'
                )}
              >
                {stepInfo.name}
              </span>
            </div>

            {/* Connector Line */}
            {/* Connector appears after each step. It's colored if this step is completed or if we're past it. */}
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2',
                  isPast || isCompleted ? 'bg-brand' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
