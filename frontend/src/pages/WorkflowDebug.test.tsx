import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WorkflowDebugPage, buildWorkflowDebugWsUrl } from './WorkflowDebug';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as useWorkflowsModule from '@/hooks/useWorkflows';
import { I18nextProvider } from 'react-i18next';
import { setTestLanguage, i18n } from '@/test/renderWithI18n';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Workflow } from '@/hooks/useWorkflows';

vi.mock('@/hooks/useWorkflows');

const useWorkflow = vi.spyOn(useWorkflowsModule, 'useWorkflow');
const useStartWorkflow = vi.spyOn(useWorkflowsModule, 'useStartWorkflow');
const usePauseWorkflow = vi.spyOn(useWorkflowsModule, 'usePauseWorkflow');
const useStopWorkflow = vi.spyOn(useWorkflowsModule, 'useStopWorkflow');

type UseWorkflowResult = UseQueryResult<Workflow>;

const createUseWorkflowResult = (
  overrides: Partial<UseWorkflowResult>
): UseWorkflowResult =>
  ({
    data: null,
    isLoading: false,
    error: null,
    ...overrides,
  }) as UseWorkflowResult;

const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  </I18nextProvider>
);

const baseWorkflow: Workflow = {
  id: 'wf-1',
  projectId: 'proj-1',
  name: 'Test Workflow',
  status: 'running',
  useSlashCommands: false,
  orchestratorEnabled: true,
  orchestratorApiType: 'openai-compatible',
  orchestratorBaseUrl: 'https://api.test.com',
  orchestratorModel: 'gpt-4o',
  errorTerminalEnabled: false,
  errorTerminalCliId: '',
  errorTerminalModelId: '',
  mergeTerminalCliId: 'bash',
  mergeTerminalModelId: 'model-1',
  targetBranch: 'main',
  readyAt: null,
  startedAt: null,
  completedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  tasks: [
    {
      id: 'task-1',
      workflowId: 'wf-1',
      vkTaskId: null,
      name: 'Task 1',
      description: 'First task',
      branch: 'feat/task-1',
      status: 'pending',
      orderIndex: 0,
      startedAt: null,
      completedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      terminals: [
        {
          id: 'term-1',
          workflowTaskId: 'task-1',
          cliTypeId: 'claude-code',
          modelConfigId: 'model-1',
          customBaseUrl: null,
          customApiKey: null,
          role: 'Expert',
          roleDescription: null,
          orderIndex: 0,
          status: 'idle',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    },
  ],
  commands: [],
};

describe('WorkflowDebugPage', () => {
  beforeEach(async () => {
    await setTestLanguage();
    // Reset mocks
    useStartWorkflow.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
    usePauseWorkflow.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
    useStopWorkflow.mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
  });

  describe('WebSocket URL', () => {
    it('should use wss protocol on HTTPS pages', () => {
      expect(
        buildWorkflowDebugWsUrl({ protocol: 'https:', host: 'example.com' })
      ).toBe('wss://example.com/api');
    });

    it('should use ws protocol on HTTP pages', () => {
      expect(
        buildWorkflowDebugWsUrl({ protocol: 'http:', host: 'localhost:5173' })
      ).toBe('ws://localhost:5173/api');
    });
  });

  describe('Loading State', () => {
    it('should show loading message when data is loading', () => {
      useWorkflow.mockReturnValue(createUseWorkflowResult({ isLoading: true }));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(<WorkflowDebugPage />, { wrapper });
      expect(
        screen.getByText(i18n.t('workflow:workflowDebug.loading'))
      ).toBeInTheDocument();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('Error State', () => {
    it('should show error message when request fails', () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({ error: new Error('Failed to load') })
      );

      render(<WorkflowDebugPage />, { wrapper });
      expect(
        screen.getByText(i18n.t('workflow:workflowDebug.error'))
      ).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render workflow header', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({ data: baseWorkflow })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText('Test Workflow', { selector: 'h1' })
        ).toBeInTheDocument();
        // Status is now displayed as a badge - there may be multiple "Running" texts
        expect(
          screen.getAllByText(i18n.t('workflow:status.running')).length
        ).toBeGreaterThan(0);
      });
    });

    it('should render back button', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({
          data: { ...baseWorkflow, name: 'Test', status: 'created' },
        })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('workflow:workflowDebug.back'))
        ).toBeInTheDocument();
      });
    });

    it('should show start button when workflow is ready', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({
          data: { ...baseWorkflow, name: 'Test', status: 'ready' },
        })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('workflow:workflowDebug.start'))
        ).toBeInTheDocument();
      });
    });

    it('should show pause and stop buttons when workflow is running', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({
          data: { ...baseWorkflow, name: 'Test', status: 'running' },
        })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('workflow:workflowDebug.pause'))
        ).toBeInTheDocument();
        expect(
          screen.getByText(i18n.t('workflow:workflowDebug.stop'))
        ).toBeInTheDocument();
      });
    });

    it('should render tabs for pipeline and terminals views', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({
          data: { ...baseWorkflow, name: 'Test', status: 'ready' },
        })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(
          screen.getByText(i18n.t('workflow:workflowDebug.tabs.pipeline'))
        ).toBeInTheDocument();
        expect(
          screen.getByText(i18n.t('workflow:workflowDebug.tabs.terminals'))
        ).toBeInTheDocument();
      });
    });
  });
});
