import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WorkflowDebugPage } from './WorkflowDebug';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as useWorkflowsModule from '@/hooks/useWorkflows';
import { I18nextProvider } from 'react-i18next';
import { setTestLanguage, i18n } from '@/test/renderWithI18n';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Workflow } from '@/hooks/useWorkflows';

vi.mock('@/hooks/useWorkflows');

const useWorkflow = vi.spyOn(useWorkflowsModule, 'useWorkflow');

type UseWorkflowResult = UseQueryResult<Workflow>;

const createUseWorkflowResult = (
  overrides: Partial<UseWorkflowResult>
): UseWorkflowResult =>
  ({
    data: null,
    isLoading: false,
    error: null,
    ...overrides,
  } as UseWorkflowResult);

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={new QueryClient()}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  </I18nextProvider>
);

const baseWorkflow: Workflow = {
  id: 'wf-1',
  name: 'Test Workflow',
  status: 'running',
  project_id: 'proj-1',
  config: {
    tasks: [],
    models: [],
    terminals: [],
    commands: { enabled: false, presetIds: [] },
    orchestrator: {
      modelConfigId: 'model-1',
      mergeTerminal: {
        cliTypeId: 'bash',
        modelConfigId: 'model-1',
        runTestsBeforeMerge: false,
        pauseOnConflict: false,
      },
      targetBranch: 'main',
    },
  },
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

describe('WorkflowDebugPage', () => {
  beforeEach(() => {
    void setTestLanguage();
  });

  describe('Loading State', () => {
    it('should show loading message when data is loading', () => {
      useWorkflow.mockReturnValue(createUseWorkflowResult({ isLoading: true }));

      render(<WorkflowDebugPage />, { wrapper });
      expect(screen.getByText(i18n.t('workflow:workflowDebug.loading'))).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when request fails', () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({ error: new Error('Failed to load') })
      );

      render(<WorkflowDebugPage />, { wrapper });
      expect(screen.getByText(i18n.t('workflow:workflowDebug.error'))).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render workflow header', async () => {
      useWorkflow.mockReturnValue(createUseWorkflowResult({ data: baseWorkflow }));

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Workflow', { selector: 'h1' })).toBeInTheDocument();
        expect(
          screen.getByText(i18n.t('workflow:workflowDebug.statusLabel', { status: 'running' }))
        ).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({ data: { ...baseWorkflow, name: 'Test', status: 'draft' } })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:workflowDebug.back'))).toBeInTheDocument();
      });
    });

    it('should show start button when workflow is ready', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({ data: { ...baseWorkflow, name: 'Test', status: 'draft' } })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:workflowDebug.start'))).toBeInTheDocument();
      });
    });

    it('should show pause and stop buttons when workflow is running', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({ data: { ...baseWorkflow, name: 'Test', status: 'running' } })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:workflowDebug.pause'))).toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:workflowDebug.stop'))).toBeInTheDocument();
      });
    });

    it('should render tabs for pipeline and terminals views', async () => {
      useWorkflow.mockReturnValue(
        createUseWorkflowResult({ data: { ...baseWorkflow, name: 'Test', status: 'draft' } })
      );

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:workflowDebug.tabs.pipeline'))).toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:workflowDebug.tabs.terminals'))).toBeInTheDocument();
      });
    });
  });
});
