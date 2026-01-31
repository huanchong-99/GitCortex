import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import type { WorkflowDetailDto } from 'shared/types';
import { WorkflowKanbanBoard } from './WorkflowKanbanBoard';

// Mock the hooks
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
  useUpdateTaskStatus: vi.fn(),
}));

import { useWorkflow, useUpdateTaskStatus } from '@/hooks/useWorkflows';

const mockMutate = vi.fn();

const workflow: WorkflowDetailDto = {
  id: 'wf-1',
  projectId: 'proj-1',
  name: 'Workflow One',
  description: null,
  status: 'running',
  useSlashCommands: false,
  orchestratorEnabled: true,
  orchestratorApiType: null,
  orchestratorBaseUrl: null,
  orchestratorModel: null,
  errorTerminalEnabled: false,
  errorTerminalCliId: null,
  errorTerminalModelId: null,
  mergeTerminalCliId: null,
  mergeTerminalModelId: null,
  targetBranch: 'main',
  readyAt: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  tasks: [
    {
      id: 'task-a',
      workflowId: 'wf-1',
      vkTaskId: null,
      name: 'Task A',
      description: null,
      branch: 'branch-a',
      status: 'pending',
      orderIndex: 0,
      startedAt: null,
      completedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      terminals: [],
    },
    {
      id: 'task-b',
      workflowId: 'wf-1',
      vkTaskId: null,
      name: 'Task B',
      description: null,
      branch: 'branch-b',
      status: 'running',
      orderIndex: 1,
      startedAt: null,
      completedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      terminals: [],
    },
  ],
  commands: [],
};

describe('WorkflowKanbanBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUpdateTaskStatus).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);
  });

  it('renders tasks in status columns', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: workflow,
      isLoading: false,
      error: null,
    } as any);

    render(<WorkflowKanbanBoard workflowId="wf-1" />);

    const pendingColumn = screen.getByTestId('kanban-column-pending');
    const runningColumn = screen.getByTestId('kanban-column-running');

    expect(within(pendingColumn).getByText('Task A')).toBeInTheDocument();
    expect(within(runningColumn).getByText('Task B')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<WorkflowKanbanBoard workflowId="wf-1" />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows select workflow message when no workflowId', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);

    render(<WorkflowKanbanBoard workflowId={null} />);

    expect(screen.getByText('Select a workflow')).toBeInTheDocument();
  });

  it('renders all six columns', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: workflow,
      isLoading: false,
      error: null,
    } as any);

    render(<WorkflowKanbanBoard workflowId="wf-1" />);

    expect(screen.getByTestId('kanban-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-running')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-review_pending')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-completed')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-failed')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-cancelled')).toBeInTheDocument();
  });

  it('displays task count in column headers', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: workflow,
      isLoading: false,
      error: null,
    } as any);

    render(<WorkflowKanbanBoard workflowId="wf-1" />);

    const pendingColumn = screen.getByTestId('kanban-column-pending');
    const runningColumn = screen.getByTestId('kanban-column-running');

    expect(within(pendingColumn).getByText('(1)')).toBeInTheDocument();
    expect(within(runningColumn).getByText('(1)')).toBeInTheDocument();
  });

  it('task cards have cursor-grab class for drag indication', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: workflow,
      isLoading: false,
      error: null,
    } as any);

    render(<WorkflowKanbanBoard workflowId="wf-1" />);

    // Find the task card by looking for the element with cursor-grab class
    const taskCards = document.querySelectorAll('.cursor-grab');
    expect(taskCards.length).toBe(2); // Two tasks in the workflow
  });
});
