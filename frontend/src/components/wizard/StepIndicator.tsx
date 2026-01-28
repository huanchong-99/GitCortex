import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = index > currentStep;

        return (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded border text-sm font-semibold',
                isCompleted && 'border-brand bg-brand text-white',
                isCurrent && 'border-brand text-brand',
                isPending && 'border-border text-low'
              )}
            >
              {isCompleted ? '✓' : index + 1}
            </div>
            <span
              className={cn(
                'ml-2 text-sm',
                isCurrent && 'text-brand',
                isPending && 'text-low'
              )}
            >
              {step}
            </span>
            {index < steps.length - 1 && (
              <div className="mx-4 w-8 h-px bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}
