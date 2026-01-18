import React from 'react';
import { WizardConfig } from '../types';

interface Step0ProjectProps {
  config: WizardConfig;
  errors: Record<string, string>;
  onUpdate: (updates: Partial<WizardConfig>) => void;
}

export const Step0Project: React.FC<Step0ProjectProps> = () => {
  return <div>Step 0: Project - Coming Soon</div>;
};
