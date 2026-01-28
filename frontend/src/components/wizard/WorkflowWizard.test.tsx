import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkflowWizard } from './WorkflowWizard';

vi.mock('@/components/wizard/StepIndicator', () => ({
  StepIndicator: () => <div data-testid="step-indicator" />,
}));

vi.mock('@/components/wizard/WorkflowConfigureStep', () => ({
  WorkflowConfigureStep: () => <div data-testid="configure-step" />,
}));

vi.mock('@/components/wizard/WorkflowReviewStep', () => ({
  WorkflowReviewStep: () => <div data-testid="review-step" />,
}));

vi.mock('@/components/wizard/WorkflowExecuteStep', () => ({
  WorkflowExecuteStep: () => <div data-testid="execute-step" />,
}));

describe('WorkflowWizard', () => {
  it('renders step indicator', () => {
    render(<WorkflowWizard projectId="proj-1" onClose={vi.fn()} />);

    expect(screen.getByTestId('step-indicator')).toBeInTheDocument();
  });

  it('shows configure step by default', () => {
    render(<WorkflowWizard projectId="proj-1" onClose={vi.fn()} />);

    expect(screen.getByTestId('configure-step')).toBeInTheDocument();
  });

  it('shows next and back buttons', () => {
    render(<WorkflowWizard projectId="proj-1" onClose={vi.fn()} />);

    expect(screen.getByText(/back/i)).toBeInTheDocument();
    expect(screen.getByText(/next/i)).toBeInTheDocument();
  });

  it('disables back button on first step', () => {
    render(<WorkflowWizard projectId="proj-1" onClose={vi.fn()} />);

    const backButton = screen.getByText(/back/i);
    expect(backButton).toBeDisabled();
  });

  it('disables next button on last step when currentStep is 2', () => {
    render(<WorkflowWizard projectId="proj-1" onClose={vi.fn()} />);

    const nextButton = screen.getByText(/next/i);
    expect(nextButton).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const handleClose = vi.fn();

    render(<WorkflowWizard projectId="proj-1" onClose={handleClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    closeButton.click();

    expect(handleClose).toHaveBeenCalled();
  });
});
