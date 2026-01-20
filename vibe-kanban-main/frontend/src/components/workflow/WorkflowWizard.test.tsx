import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowWizard } from './WorkflowWizard';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

describe('WorkflowWizard', () => {
  beforeEach(() => {
    void setTestLanguage();
  });

  it('should render wizard with step indicator', () => {
    renderWithI18n(
      <WorkflowWizard
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(i18n.t('workflow:wizard.title'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:step0.fieldLabel'))).toBeInTheDocument();
  });

  it('should start at Project step (Step 0)', () => {
    renderWithI18n(
      <WorkflowWizard
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(i18n.t('workflow:step0.fieldLabel'))).toBeInTheDocument();
  });

  it('should call onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    renderWithI18n(
      <WorkflowWizard
        onComplete={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByText(i18n.t('workflow:wizard.buttons.cancel'));
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
