import React from 'react';

interface Step1BasicProps {
  config: any;
  errors: Record<string, string>;
  onUpdate: (updates: any) => void;
}

export const Step1Basic: React.FC<Step1BasicProps> = () => {
  return <div>Step 1: Basic - Coming Soon</div>;
};
