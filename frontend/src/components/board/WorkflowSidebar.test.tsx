import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowSidebar } from './WorkflowSidebar';

vi.mock('@/hooks/useProjects', () => ({
  useProjects: vi.fn(),
}));

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflows: vi.fn(),
}));

import { useProjects } from '@/hooks/useProjects';
import { useWorkflows } from '@/hooks/useWorkflows';

describe('WorkflowSidebar', () => {
  it('renders workflows list', () => {
    vi.mocked(useProjects).mockReturnValue({
      projects: [{ id: 'proj-1', name: 'Project One' }],
      projectsById: {},
      isLoading: false,
      isConnected: true,
      error: null,
    });

    vi.mocked(useWorkflows).mockReturnValue({
      data: [
        {
          id: 'wf-1',
          projectId: 'proj-1',
          name: 'Workflow A',
          description: null,
          status: 'created',
          createdAt: '',
          updatedAt: '',
          tasksCount: 0,
          terminalsCount: 0,
        },
      ],
      isLoading: false,
      error: null,
    } as any);

    render(
      <WorkflowSidebar
        selectedWorkflowId={null}
        onSelectWorkflow={() => {}}
      />
    );

    expect(screen.getByText('Workflow A')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useProjects).mockReturnValue({
      projects: [{ id: 'proj-1', name: 'Project One' }],
      projectsById: {},
      isLoading: false,
      isConnected: true,
      error: null,
    });

    vi.mocked(useWorkflows).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    } as any);

    render(
      <WorkflowSidebar
        selectedWorkflowId={null}
        onSelectWorkflow={() => {}}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
