import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkflowCard } from './WorkflowCard';

describe('WorkflowCard', () => {
  it('renders name and status', () => {
    render(
      <WorkflowCard
        name="Workflow A"
        status="running"
        selected={false}
        onClick={() => {}}
      />
    );

    expect(screen.getByText('Workflow A')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('applies selected styling', () => {
    const { rerender } = render(
      <WorkflowCard
        name="Workflow B"
        status="created"
        selected={false}
        onClick={() => {}}
      />
    );

    const button = screen.getByRole('button');
    expect(button.className).not.toContain('border-brand');

    rerender(
      <WorkflowCard
        name="Workflow B"
        status="created"
        selected={true}
        onClick={() => {}}
      />
    );

    expect(button.className).toContain('border-brand');
  });
});
