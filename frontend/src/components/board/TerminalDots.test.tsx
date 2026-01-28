import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TerminalDots } from './TerminalDots';

describe('TerminalDots', () => {
  it('renders one dot per terminal', () => {
    render(<TerminalDots terminalCount={3} />);

    expect(screen.getAllByTestId('terminal-dot')).toHaveLength(3);
  });
});
