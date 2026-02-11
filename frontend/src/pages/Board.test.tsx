import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Board } from './Board';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? '',
  }),
}));

vi.mock('@/stores/wsStore', () => ({
  useWorkflowEvents: vi.fn(),
}));

vi.mock('@/components/board/WorkflowSidebar', () => ({
  WorkflowSidebar: () => <aside data-testid="workflow-sidebar" />,
}));
vi.mock('@/components/board/WorkflowKanbanBoard', () => ({
  WorkflowKanbanBoard: () => <section data-testid="workflow-board" />,
}));
vi.mock('@/components/board/TerminalActivityPanel', () => ({
  TerminalActivityPanel: () => <div data-testid="terminal-activity" />,
}));
vi.mock('@/components/board/StatusBar', () => ({
  StatusBar: () => <footer data-testid="status-bar" />,
}));

describe('Board', () => {
  it('renders board layout sections', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <Board />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('workflow-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-board')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-activity')).toBeInTheDocument();
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });
});
