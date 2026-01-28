import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TerminalDetailPanel } from './TerminalDetailPanel';

describe('TerminalDetailPanel', () => {
  it('renders terminal details', () => {
    render(<TerminalDetailPanel role="Planner" status="running" model="gpt-4o" />);

    expect(screen.getByText('Planner')).toBeInTheDocument();
    expect(screen.getByText('Status: running')).toBeInTheDocument();
    expect(screen.getByText('Model: gpt-4o')).toBeInTheDocument();
  });
});
