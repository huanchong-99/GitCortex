import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OrchestratorHeader } from './OrchestratorHeader';

describe('OrchestratorHeader', () => {
  it('renders workflow metadata', () => {
    render(<OrchestratorHeader name="Workflow X" status="running" model="gpt-4o" />);

    expect(screen.getByText('Workflow X')).toBeInTheDocument();
    expect(screen.getByText(/status: running/i)).toBeInTheDocument();
    expect(screen.getByText(/model: gpt-4o/i)).toBeInTheDocument();
  });
});
