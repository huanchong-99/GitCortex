import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkflowExecuteStep } from './WorkflowExecuteStep';

describe('WorkflowExecuteStep', () => {
  it('renders execution status', () => {
    render(<WorkflowExecuteStep />);

    expect(screen.getByText(/execute workflow/i)).toBeInTheDocument();
  });
});
