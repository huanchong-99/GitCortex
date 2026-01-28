import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkflowDebugPage } from './WorkflowDebugPage';

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
}));

vi.mock('@/components/debug/TerminalSidebar', () => ({
  TerminalSidebar: () => <div data-testid="terminal-sidebar" />,
}));

vi.mock('@/components/debug/TerminalDebugView', () => ({
  TerminalDebugView: () => <div data-testid="terminal-debug-view" />,
}));

import { useWorkflow } from '@/hooks/useWorkflows';

describe('WorkflowDebugPage', () => {
  it('renders sidebar and debug view when workflow exists', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: {
        id: 'wf-1',
        name: 'Workflow X',
        status: 'running',
        orchestratorModel: 'gpt-4o',
        terminals: [
          { id: 't1', role: 'Planner', cliTypeId: 'bash', status: 'active' },
        ],
        tasks: [],
      },
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/debug/wf-1']}>
        <Routes>
          <Route path="/debug/:workflowId" element={<WorkflowDebugPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('terminal-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-debug-view')).toBeInTheDocument();
  });

  it('shows loading state when loading', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/debug/wf-1']}>
        <Routes>
          <Route path="/debug/:workflowId" element={<WorkflowDebugPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state when workflow not found', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Not found'),
    } as any);

    render(
      <MemoryRouter initialEntries={['/debug/wf-1']}>
        <Routes>
          <Route path="/debug/:workflowId" element={<WorkflowDebugPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Workflow not found')).toBeInTheDocument();
  });
});
