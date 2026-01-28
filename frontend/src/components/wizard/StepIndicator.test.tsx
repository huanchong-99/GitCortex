import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StepIndicator } from './StepIndicator';

describe('StepIndicator', () => {
  const steps = ['Configure', 'Review', 'Execute'];

  it('renders all steps', () => {
    render(<StepIndicator steps={steps} currentStep={0} />);

    expect(screen.getByText('Configure')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Execute')).toBeInTheDocument();
  });

  it('highlights current step', () => {
    render(<StepIndicator steps={steps} currentStep={1} />);

    const currentStep = screen.getByText('Review');
    expect(currentStep).toHaveClass('text-brand');
  });

  it('shows completed steps as checkmarks', () => {
    render(<StepIndicator steps={steps} currentStep={2} />);

    const completedSteps = screen.getAllByText('✓');
    expect(completedSteps).toHaveLength(2);
  });

  it('shows pending steps as muted', () => {
    render(<StepIndicator steps={steps} currentStep={0} />);

    const reviewStep = screen.getByText('Review');
    const executeStep = screen.getByText('Execute');
    expect(reviewStep).toHaveClass('text-low');
    expect(executeStep).toHaveClass('text-low');
  });
});
