import React from 'react';
import { WizardConfig } from '../types';

interface Step3ModelsProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

export const Step3Models: React.FC<Step3ModelsProps> = () => {
  return <div>Step 3: Models - Coming Soon</div>;
};
