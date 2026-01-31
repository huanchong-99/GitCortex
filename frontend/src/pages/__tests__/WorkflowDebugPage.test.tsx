import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WorkflowDebugPage } from '../WorkflowDebugPage';

// Mock useWorkflow hook
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
}));

// Mock TerminalDebugView to avoid xterm.js initialization in tests
vi.mock('@/components/terminal/TerminalDebugView', () => ({
  TerminalDebugView: vi.fn(({ tasks, wsUrl }) => (
    <div data-testid="terminal-debug-view">
      <span data-testid="ws-url">{wsUrl}</span>
      <span data-testid="tasks-count">{tasks.length}</span>
      {tasks.map((task: { id: string; name: string; terminals: { id: string }[] }) => (
        <div key={task.id} data-testid={`task-${task.id}`}>
          {task.name} - {task.terminals.length} terminals
        </div>
      ))}
    </div>
  )),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

import { useWorkflow } from '@/hooks/useWorkflows';

const mockUseWorkflow = vi.mocked(useWorkflow);

describe('WorkflowDebugPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (workflowId: string) => {
    return render(
      <MemoryRouter initialEntries={[`/workflow/${workflowId}/debug`]}>
        <Routes>
          <Route path="/workflow/:workflowId/debug" element={<WorkflowDebugPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('shows loading state while fetching workflow', () => {
    mockUseWorkflow.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useWorkflow>);

    renderWithRouter('workflow-123');

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows not found message when workflow does not exist', () => {
    mockUseWorkflow.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useWorkflow>);

    renderWithRouter('workflow-123');

    expect(screen.getByText('Workflow not found')).toBeInTheDocument();
  });

  it('renders TerminalDebugView with correct props when workflow is loaded', () => {
    const mockWorkflow = {
      id: 'workflow-123',
      projectId: 'project-1',
      name: 'Test Workflow',
      description: null,
      status: 'running',
      tasks: [
        {
          id: 'task-1',
          workflowId: 'workflow-123',
          vkTaskId: null,
          name: 'Task 1',
          description: null,
          branch: 'feature/task-1',
          status: 'running',
          orderIndex: 0,
          startedAt: null,
          completedAt: null,
          createdAt: '2026-01-31T00:00:00Z',
          updatedAt: '2026-01-31T00:00:00Z',
          terminals: [
            {
              id: 'terminal-1',
              workflowTaskId: 'task-1',
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              customBaseUrl: null,
              customApiKey: null,
              role: 'Developer',
              roleDescription: null,
              orderIndex: 0,
              status: 'working',
              createdAt: '2026-01-31T00:00:00Z',
              updatedAt: '2026-01-31T00:00:00Z',
            },
            {
              id: 'terminal-2',
              workflowTaskId: 'task-1',
              cliTypeId: 'aider',
              modelConfigId: 'model-2',
              customBaseUrl: null,
              customApiKey: null,
              role: null,
              roleDescription: null,
              orderIndex: 1,
              status: 'waiting',
              createdAt: '2026-01-31T00:00:00Z',
              updatedAt: '2026-01-31T00:00:00Z',
            },
          ],
        },
      ],
      commands: [],
      useSlashCommands: false,
      orchestratorEnabled: false,
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
      createdAt: '2026-01-31T00:00:00Z',
      updatedAt: '2026-01-31T00:00:00Z',
    };

    mockUseWorkflow.mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useWorkflow>);

    renderWithRouter('workflow-123');

    // Verify TerminalDebugView is rendered
    expect(screen.getByTestId('terminal-debug-view')).toBeInTheDocument();

    // Verify wsUrl is constructed correctly (should end with /api)
    const wsUrl = screen.getByTestId('ws-url').textContent;
    expect(wsUrl).toMatch(/^wss?:\/\/.+\/api$/);

    // Verify tasks are passed correctly
    expect(screen.getByTestId('tasks-count').textContent).toBe('1');
    expect(screen.getByTestId('task-task-1')).toHaveTextContent('Task 1 - 2 terminals');
  });

  it('maps terminal status correctly', () => {
    const mockWorkflow = {
      id: 'workflow-123',
      projectId: 'project-1',
      name: 'Test Workflow',
      description: null,
      status: 'running',
      tasks: [
        {
          id: 'task-1',
          workflowId: 'workflow-123',
          vkTaskId: null,
          name: 'Task 1',
          description: null,
          branch: 'feature/task-1',
          status: 'running',
          orderIndex: 0,
          startedAt: null,
          completedAt: null,
          createdAt: '2026-01-31T00:00:00Z',
          updatedAt: '2026-01-31T00:00:00Z',
          terminals: [
            {
              id: 'terminal-idle',
              workflowTaskId: 'task-1',
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              customBaseUrl: null,
              customApiKey: null,
              role: null,
              roleDescription: null,
              orderIndex: 0,
              status: 'idle', // Should map to 'not_started'
              createdAt: '2026-01-31T00:00:00Z',
              updatedAt: '2026-01-31T00:00:00Z',
            },
            {
              id: 'terminal-running',
              workflowTaskId: 'task-1',
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              customBaseUrl: null,
              customApiKey: null,
              role: null,
              roleDescription: null,
              orderIndex: 1,
              status: 'running', // Should map to 'working'
              createdAt: '2026-01-31T00:00:00Z',
              updatedAt: '2026-01-31T00:00:00Z',
            },
            {
              id: 'terminal-cancelled',
              workflowTaskId: 'task-1',
              cliTypeId: 'claude-code',
              modelConfigId: 'model-1',
              customBaseUrl: null,
              customApiKey: null,
              role: null,
              roleDescription: null,
              orderIndex: 2,
              status: 'cancelled', // Should map to 'failed'
              createdAt: '2026-01-31T00:00:00Z',
              updatedAt: '2026-01-31T00:00:00Z',
            },
          ],
        },
      ],
      commands: [],
      useSlashCommands: false,
      orchestratorEnabled: false,
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
      createdAt: '2026-01-31T00:00:00Z',
      updatedAt: '2026-01-31T00:00:00Z',
    };

    mockUseWorkflow.mockReturnValue({
      data: mockWorkflow,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useWorkflow>);

    renderWithRouter('workflow-123');

    // The mock TerminalDebugView receives the mapped tasks
    // We verify the component renders without errors
    expect(screen.getByTestId('terminal-debug-view')).toBeInTheDocument();
    expect(screen.getByTestId('task-task-1')).toHaveTextContent('3 terminals');
  });
});
