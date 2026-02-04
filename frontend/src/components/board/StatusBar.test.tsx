import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusBar } from './StatusBar';

// Mock the stores
vi.mock('@/stores/workflowStore', () => ({
  useWorkflowStore: vi.fn((selector) => {
    const state = {
      workflows: new Map([
        [
          'workflow-1',
          {
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
        ],
      ]),
    };
    return selector(state);
  }),
}));

vi.mock('@/stores/wsStore', () => ({
  useWsStore: vi.fn((selector) => {
    const state = { connectionStatus: 'connected' };
    return selector(state);
  }),
}));

describe('StatusBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders orchestrator status and metadata with workflow', () => {
    render(<StatusBar workflowId="workflow-1" />);
    expect(screen.getByText('Orchestrator Active')).toBeInTheDocument();
    expect(screen.getByText('2 Terminals Running')).toBeInTheDocument();
    expect(screen.getByText('Git: Listening')).toBeInTheDocument();
  });

  it('renders inactive state when no workflow selected', () => {
    render(<StatusBar workflowId={null} />);
    expect(screen.getByText('Orchestrator Inactive')).toBeInTheDocument();
    expect(screen.getByText('0 Terminals Running')).toBeInTheDocument();
  });
});
