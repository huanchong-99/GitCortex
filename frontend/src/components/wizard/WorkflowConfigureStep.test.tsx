import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkflowConfigureStep } from './WorkflowConfigureStep';

describe('WorkflowConfigureStep', () => {
  it('renders configuration form', () => {
    render(<WorkflowConfigureStep projectId="proj-1" />);

    expect(screen.getByText(/configure workflow/i)).toBeInTheDocument();
  });
});
