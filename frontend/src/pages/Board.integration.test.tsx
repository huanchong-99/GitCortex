import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Board } from './Board';

// Mock hooks
vi.mock('@/hooks/useWorkflows', () => ({
  useProjects: vi.fn(() => ({
    projects: [{ id: 'proj-1', name: 'Project 1' }],
  })),
  useWorkflows: vi.fn(() => ({
    data: [
      { id: 'wf-1', name: 'Workflow A', status: 'running' },
      { id: 'wf-2', name: 'Workflow B', status: 'created' },
    ],
    isLoading: false,
  })),
  useWorkflow: vi.fn((id) => ({
    data: {
      id,
      name: `Workflow ${id}`,
      status: 'running',
      tasks: [
        {
          id: 'task-1',
          name: 'Task 1',
          status: 'created',
          branch: 'main',
          terminals: [{ id: 't1', cliTypeId: 'bash' }],
        },
        {
          id: 'task-2',
          name: 'Task 2',
          status: 'running',
          branch: 'feature',
          terminals: [{ id: 't2', cliTypeId: 'bash' }, { id: 't3', cliTypeId: 'bash' }],
        },
      ],
    },
    isLoading: false,
  })),
}));

describe('Board integration', () => {
  it('renders complete board layout with sidebar and kanban', () => {
    render(
      <MemoryRouter initialEntries={['/board']}>
        <Board />
      </MemoryRouter>
    );

    // Sidebar should be visible
    expect(screen.getByText('Workflows')).toBeInTheDocument();

    // Workflows should be listed
    expect(screen.getByText('Workflow A')).toBeInTheDocument();
    expect(screen.getByText('Workflow B')).toBeInTheDocument();

    // Kanban columns should be present (shown by default)
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('displays tasks with terminal information', () => {
    render(
      <MemoryRouter initialEntries={['/board']}>
        <Board />
      </MemoryRouter>
    );

    // Tasks should be visible
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();

    // Terminal dots should be rendered
    const terminalDots = screen.getAllByTestId('terminal-dot');
    expect(terminalDots.length).toBeGreaterThan(0);
  });

  it('shows status bar with orchestrator information', () => {
    render(
      <MemoryRouter initialEntries={['/board']}>
        <Board />
      </MemoryRouter>
    );

    // Status bar should show orchestrator is active
    expect(screen.getByText('Orchestrator Active')).toBeInTheDocument();

    // Should show terminals running
    expect(screen.getByText(/Terminals Running/i)).toBeInTheDocument();
  });

  it('displays terminal activity panel', () => {
    render(
      <MemoryRouter initialEntries={['/board']}>
        <Board />
      </MemoryRouter>
    );

    // Activity panel should be visible
    expect(screen.getByText('Terminal Activity')).toBeInTheDocument();
  });
});
