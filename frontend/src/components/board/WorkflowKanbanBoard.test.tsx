import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { WorkflowDetailDto } from 'shared/types';
import { WorkflowKanbanBoard } from './WorkflowKanbanBoard';

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
}));

import { useWorkflow } from '@/hooks/useWorkflows';

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
      status: 'created',
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
  it('renders tasks in status columns', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: workflow,
      isLoading: false,
      error: null,
    } as any);

    render(<WorkflowKanbanBoard workflowId="wf-1" />);

    const createdColumn = screen.getByTestId('kanban-column-created');
    const runningColumn = screen.getByTestId('kanban-column-running');

    expect(within(createdColumn).getByText('Task A')).toBeInTheDocument();
    expect(within(runningColumn).getByText('Task B')).toBeInTheDocument();
  });
});
