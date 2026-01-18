import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { WorkflowDebugPage } from './WorkflowDebug';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as useWorkflowsModule from '@/hooks/useWorkflows';

// Mock hooks
vi.mock('@/hooks/useWorkflows');

const useWorkflow = vi.spyOn(useWorkflowsModule, 'useWorkflow');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('WorkflowDebugPage', () => {
  describe('Loading State', () => {
    it('should show loading message when data is loading', () => {
      useWorkflow.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      } as any);

      render(<WorkflowDebugPage />, { wrapper });
      expect(screen.getByText('加载中...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when request fails', () => {
      useWorkflow.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to load'),
      } as any);

      render(<WorkflowDebugPage />, { wrapper });
      expect(screen.getByText('加载失败')).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    it('should render workflow header', async () => {
      useWorkflow.mockReturnValue({
        data: {
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
        },
        isLoading: false,
        error: null,
      } as any);

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Test Workflow', { selector: 'h1' })).toBeInTheDocument();
        expect(screen.getByText('状态: running')).toBeInTheDocument();
      });
    });

    it('should render back button', async () => {
      useWorkflow.mockReturnValue({
        data: {
          id: 'wf-1',
          name: 'Test',
          status: 'draft',
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
        },
        isLoading: false,
        error: null,
      } as any);

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('返回')).toBeInTheDocument();
      });
    });

    it('should show start button when workflow is ready', async () => {
      useWorkflow.mockReturnValue({
        data: {
          id: 'wf-1',
          name: 'Test',
          status: 'draft',
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
        },
        isLoading: false,
        error: null,
      } as any);

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('开始')).toBeInTheDocument();
      });
    });

    it('should show pause and stop buttons when workflow is running', async () => {
      useWorkflow.mockReturnValue({
        data: {
          id: 'wf-1',
          name: 'Test',
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
        },
        isLoading: false,
        error: null,
      } as any);

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('暂停')).toBeInTheDocument();
        expect(screen.getByText('停止')).toBeInTheDocument();
      });
    });

    it('should render tabs for pipeline and terminals views', async () => {
      useWorkflow.mockReturnValue({
        data: {
          id: 'wf-1',
          name: 'Test',
          status: 'draft',
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
        },
        isLoading: false,
        error: null,
      } as any);

      render(<WorkflowDebugPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('流水线视图')).toBeInTheDocument();
        expect(screen.getByText('终端调试')).toBeInTheDocument();
      });
    });
  });
});
