import React from 'react';
import { WizardConfig } from '../types';

interface Step2TasksProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

export const Step2Tasks: React.FC<Step2TasksProps> = () => {
  return <div>Step 2: Tasks - Coming Soon</div>;
};
