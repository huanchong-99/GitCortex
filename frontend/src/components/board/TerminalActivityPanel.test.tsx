import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TerminalActivityPanel } from './TerminalActivityPanel';

describe('TerminalActivityPanel', () => {
  it('renders placeholder activity', () => {
    render(<TerminalActivityPanel />);
    expect(screen.getByText('Terminal Activity')).toBeInTheDocument();
    expect(screen.getByText('[T1] $ git status')).toBeInTheDocument();
  });
});
