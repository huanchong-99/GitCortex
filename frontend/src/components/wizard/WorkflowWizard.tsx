import { useState } from 'react';
import { X } from 'lucide-react';
import { StepIndicator } from './StepIndicator';
import { WorkflowConfigureStep } from './WorkflowConfigureStep';
import { WorkflowReviewStep } from './WorkflowReviewStep';
import { WorkflowExecuteStep } from './WorkflowExecuteStep';

interface WorkflowWizardProps {
  projectId: string;
  onClose: () => void;
}

const STEPS = ['Configure', 'Review', 'Execute'];

export function WorkflowWizard({ projectId, onClose }: WorkflowWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-panel rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="h-16 border-b border-border px-6 flex items-center justify-between">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentStep === 0 && <WorkflowConfigureStep projectId={projectId} />}
          {currentStep === 1 && <WorkflowReviewStep />}
          {currentStep === 2 && <WorkflowExecuteStep />}
        </div>

        <div className="h-16 border-t border-border px-6 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-4 py-2 rounded border border-border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-secondary transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            disabled={currentStep === STEPS.length - 1}
            className="px-4 py-2 rounded bg-brand text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
