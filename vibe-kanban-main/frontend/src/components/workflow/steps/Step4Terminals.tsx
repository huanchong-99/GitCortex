import React from 'react';
import { WizardConfig } from '../types';

interface Step4TerminalsProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

export const Step4Terminals: React.FC<Step4TerminalsProps> = () => {
  return <div>Step 4: Terminals - Coming Soon</div>;
};
