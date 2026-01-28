import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TerminalDebugView } from './TerminalDebugView';

describe('TerminalDebugView', () => {
  it('renders terminal when terminalId provided', () => {
    const mockTerminal = {
      id: 't1',
      role: 'Planner',
      cliTypeId: 'bash',
      status: 'active',
      modelConfigId: 'gpt-4o',
    };

    render(<TerminalDebugView terminalId="t1" terminals={[mockTerminal]} onClose={vi.fn()} />);

    expect(screen.getByText('Planner')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows placeholder when no terminal selected', () => {
    render(<TerminalDebugView terminalId={null} terminals={[]} onClose={vi.fn()} />);

    expect(screen.getByText('Select a terminal to view details')).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const mockTerminal = {
      id: 't1',
      role: 'Planner',
      cliTypeId: 'bash',
      status: 'active',
      modelConfigId: 'gpt-4o',
    };
    const handleClose = vi.fn();

    render(<TerminalDebugView terminalId="t1" terminals={[mockTerminal]} onClose={handleClose} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    closeButton.click();

    expect(handleClose).toHaveBeenCalled();
  });
});
