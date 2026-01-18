import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowWizard } from './WorkflowWizard';

describe('WorkflowWizard', () => {
  it('should render wizard with step indicator', () => {
    render(
      <WorkflowWizard
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText('创建工作流')).toBeInTheDocument();
    expect(screen.getByText('工作目录')).toBeInTheDocument();
  });

  it('should start at Project step (Step 0)', () => {
    render(
      <WorkflowWizard
        onComplete={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    // Should show step 0 content
    expect(screen.getByText('工作目录')).toBeInTheDocument();
  });

  it('should call onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    render(
      <WorkflowWizard
        onComplete={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByText('取消');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
