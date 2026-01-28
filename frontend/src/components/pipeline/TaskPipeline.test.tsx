import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskPipeline } from './TaskPipeline';

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
}));

vi.mock('./TerminalNode', () => ({
  TerminalNode: () => <div data-testid="terminal-node" />,
}));

vi.mock('./MergeTerminalNode', () => ({
  MergeTerminalNode: () => <div data-testid="merge-node" />,
}));

import { useWorkflow } from '@/hooks/useWorkflows';

describe('TaskPipeline', () => {
  it('renders tasks and merge node', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: { tasks: [{ id: 'task-1', name: 'Task One', terminals: [] }] },
      isLoading: false,
      error: null,
    } as any);

    render(<TaskPipeline workflowId="wf-1" />);
    expect(screen.getByText('Task One')).toBeInTheDocument();
    expect(screen.getByTestId('merge-node')).toBeInTheDocument();
  });
});
