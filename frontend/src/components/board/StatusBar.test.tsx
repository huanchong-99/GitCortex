import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { i18n, setTestLanguage } from '@/test/renderWithI18n';
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

const renderStatusBar = (props: { workflowId: string | null }) =>
  render(
    <I18nextProvider i18n={i18n}>
      <StatusBar {...props} />
    </I18nextProvider>
  );

describe('StatusBar', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setTestLanguage('en');
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
              { id: 't1', status: 'working' },
              { id: 't2', status: 'completed' },
            ],
          },
          {
            id: 'task-2',
            terminals: [{ id: 't3', status: 'working' }],
          },
        ],
      },
      isLoading: false,
      error: null,
    } as any);

    renderStatusBar({ workflowId: 'workflow-1' });
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

    renderStatusBar({ workflowId: null });
    expect(screen.getByText('Orchestrator Inactive')).toBeInTheDocument();
    expect(screen.getByText('0 Terminals Running')).toBeInTheDocument();
  });
});
