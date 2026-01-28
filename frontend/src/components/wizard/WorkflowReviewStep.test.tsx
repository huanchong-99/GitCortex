import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkflowReviewStep } from './WorkflowReviewStep';

describe('WorkflowReviewStep', () => {
  it('renders review summary', () => {
    render(<WorkflowReviewStep />);

    expect(screen.getByText(/review workflow/i)).toBeInTheDocument();
  });
});
