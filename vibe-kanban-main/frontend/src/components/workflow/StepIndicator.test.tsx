import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepIndicator } from './StepIndicator';
import { WizardStep } from './types';

describe('StepIndicator', () => {
  it('should render all 7 steps', () => {
    render(
      <StepIndicator
        currentStep={WizardStep.Project}
        completedSteps={[]}
      />
    );

    expect(screen.getByText('工作目录')).toBeInTheDocument();
    expect(screen.getByText('基础配置')).toBeInTheDocument();
    expect(screen.getByText('任务配置')).toBeInTheDocument();
    expect(screen.getByText('模型配置')).toBeInTheDocument();
    expect(screen.getByText('终端配置')).toBeInTheDocument();
    expect(screen.getByText('斜杠命令')).toBeInTheDocument();
    expect(screen.getByText('高级配置')).toBeInTheDocument();
  });

  it('should mark current step as active', () => {
    const { container } = render(
      <StepIndicator
        currentStep={WizardStep.Basic}
        completedSteps={[]}
      />
    );

    const steps = container.querySelectorAll('div.rounded-full');
    expect(steps[1]).toHaveClass('border-brand', 'text-brand', 'bg-brand/10');
  });

  it('should mark completed steps with check icon', () => {
    render(
      <StepIndicator
        currentStep={WizardStep.Tasks}
        completedSteps={[WizardStep.Project, WizardStep.Basic]}
      />
    );

    // Check that completed steps have checkmarks
    const checkIcons = document.querySelectorAll('svg.lucide-check');
    expect(checkIcons.length).toBeGreaterThanOrEqual(2);
  });
});
