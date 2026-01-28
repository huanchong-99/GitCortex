import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  it('renders orchestrator status and metadata', () => {
    render(<StatusBar />);
    expect(screen.getByText('Orchestrator Active')).toBeInTheDocument();
    expect(screen.getByText('3 Terminals Running')).toBeInTheDocument();
  });
});
