import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TerminalDto } from 'shared/types';
import { TerminalNode } from './TerminalNode';

const terminal: TerminalDto = {
  id: 'term-1',
  workflowTaskId: 'task-1',
  cliTypeId: 'claude-code',
  modelConfigId: 'model-1',
  customBaseUrl: null,
  customApiKey: null,
  role: 'Planner',
  roleDescription: null,
  orderIndex: 0,
  status: 'running',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('TerminalNode', () => {
  it('renders terminal info', () => {
    render(<TerminalNode terminal={terminal} />);

    expect(screen.getByText('claude-code')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('does not show details initially', () => {
    render(<TerminalNode terminal={terminal} />);

    expect(screen.queryByText('Status: running')).toBeNull();
  });
});
