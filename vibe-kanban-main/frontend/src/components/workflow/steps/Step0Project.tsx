import React from 'react';

interface Step0ProjectProps {
  config: any;
  errors: Record<string, string>;
  onUpdate: (updates: any) => void;
}

export const Step0Project: React.FC<Step0ProjectProps> = () => {
  return <div>Step 0: Project - Coming Soon</div>;
};
