import React from 'react';

interface Step2TasksProps {
  config: any;
  errors: Record<string, string>;
  onUpdate: (updates: any) => void;
}

export const Step2Tasks: React.FC<Step2TasksProps> = () => {
  return <div>Step 2: Tasks - Coming Soon</div>;
};
