import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBar } from './StatusBar';

// Mock the hooks
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
}));

vi.mock('@/stores/wsStore', () => ({
  useWsStore: vi.fn((selector) => {
    const state = {
      connectionStatus: 'connected',
      getWorkflowConnectionStatus: vi.fn(() => 'connected'),
    };
    return selector(state);
  }),
}));

import { useWorkflow } from '@/hooks/useWorkflows';

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders orchestrator status and metadata with workflow', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: {
        id: 'workflow-1',
        orchestratorEnabled: true,
        tasks: [
          {
            id: 'task-1',
            terminals: [
              { id: 't1', status: 'running' },
              { id: 't2', status: 'completed' },
            ],
          },
          {
            id: 'task-2',
            terminals: [{ id: 't3', status: 'running' }],
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    render(<StatusBar workflowId="workflow-1" />);
    expect(screen.getByText('Orchestrator Active')).toBeInTheDocument();
    expect(screen.getByText('2 Terminals Running')).toBeInTheDocument();
    expect(screen.getByText('Git: Listening')).toBeInTheDocument();
  });

  it('renders inactive state when no workflow selected', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);

    render(<StatusBar workflowId={null} />);
    expect(screen.getByText('Orchestrator Inactive')).toBeInTheDocument();
    expect(screen.getByText('0 Terminals Running')).toBeInTheDocument();
  });
});
