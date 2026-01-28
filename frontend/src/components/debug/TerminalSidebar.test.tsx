import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TerminalSidebar } from './TerminalSidebar';

describe('TerminalSidebar', () => {
  it('renders terminal list with correct count', () => {
    const mockTerminals = [
      { id: 't1', role: 'Planner', cliTypeId: 'bash', status: 'active' },
      { id: 't2', role: 'Executor', cliTypeId: 'bash', status: 'active' },
    ];

    render(<TerminalSidebar terminals={mockTerminals} selectedTerminalId="t1" onSelect={vi.fn()} />);

    expect(screen.getByText('Planner')).toBeInTheDocument();
    expect(screen.getByText('Executor')).toBeInTheDocument();
  });

  it('highlights selected terminal', () => {
    const mockTerminals = [
      { id: 't1', role: 'Planner', cliTypeId: 'bash', status: 'active' },
    ];

    render(<TerminalSidebar terminals={mockTerminals} selectedTerminalId="t1" onSelect={vi.fn()} />);

    const selectedTerminal = screen.getByText('Planner').closest('button');
    expect(selectedTerminal).toHaveClass('border-brand');
  });

  it('calls onSelect when terminal clicked', () => {
    const mockTerminals = [
      { id: 't1', role: 'Planner', cliTypeId: 'bash', status: 'active' },
    ];
    const handleSelect = vi.fn();

    render(<TerminalSidebar terminals={mockTerminals} selectedTerminalId={null} onSelect={handleSelect} />);

    const terminalButton = screen.getByText('Planner').closest('button');
    terminalButton?.click();

    expect(handleSelect).toHaveBeenCalledWith('t1');
  });
});
