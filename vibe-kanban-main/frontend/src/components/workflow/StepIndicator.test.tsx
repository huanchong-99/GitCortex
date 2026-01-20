import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { StepIndicator } from './StepIndicator';
import { WizardStep } from './types';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

describe('StepIndicator', () => {
  beforeEach(() => {
    void setTestLanguage();
  });

  it('should render all 7 steps', () => {
    renderWithI18n(
      <StepIndicator
        currentStep={WizardStep.Project}
        completedSteps={[]}
      />
    );

    expect(screen.getByText(i18n.t('workflow:steps.project.name'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:steps.basic.name'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:steps.tasks.name'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:steps.models.name'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:steps.terminals.name'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:steps.commands.name'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:steps.advanced.name'))).toBeInTheDocument();
  });

  it('should mark current step as active', () => {
    const { container } = renderWithI18n(
      <StepIndicator
        currentStep={WizardStep.Basic}
        completedSteps={[]}
      />
    );

    const steps = container.querySelectorAll('div.rounded-full');
    expect(steps[1]).toHaveClass('border-brand', 'text-brand', 'bg-brand/10');
  });

  it('should mark completed steps with check icon', () => {
    const { container } = renderWithI18n(
      <StepIndicator
        currentStep={WizardStep.Tasks}
        completedSteps={[WizardStep.Project, WizardStep.Basic]}
      />
    );

    const checkIcons = container.querySelectorAll('svg.lucide-check');
    expect(checkIcons.length).toBeGreaterThanOrEqual(2);
  });

  it('should color connector lines based on step completion', () => {
    const { container } = renderWithI18n(
      <StepIndicator
        currentStep={WizardStep.Tasks}
        completedSteps={[WizardStep.Project, WizardStep.Basic]}
      />
    );

    const connectors = container.querySelectorAll('.flex-1.h-0\\.5');
    expect(connectors[0]).toHaveClass('bg-brand');
    expect(connectors[1]).toHaveClass('bg-brand');
    expect(connectors[2]).toHaveClass('bg-muted');
  });
});
