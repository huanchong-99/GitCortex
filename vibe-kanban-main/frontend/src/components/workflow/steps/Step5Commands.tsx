import React from 'react';
import { WizardConfig } from '../types';

interface Step5CommandsProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

export const Step5Commands: React.FC<Step5CommandsProps> = () => {
  return <div>Step 5: Commands - Coming Soon</div>;
};
