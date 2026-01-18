import React from 'react';
import { WizardConfig } from '../types';

interface Step1BasicProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

export const Step1Basic: React.FC<Step1BasicProps> = () => {
  return <div>Step 1: Basic - Coming Soon</div>;
};
