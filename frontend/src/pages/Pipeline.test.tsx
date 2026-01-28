import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Pipeline } from './Pipeline';

vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
}));

vi.mock('@/components/pipeline/OrchestratorHeader', () => ({
  OrchestratorHeader: () => <div data-testid="orchestrator-header" />,
}));

vi.mock('@/components/pipeline/TaskPipeline', () => ({
  TaskPipeline: () => <div data-testid="task-pipeline" />,
}));

import { useWorkflow } from '@/hooks/useWorkflows';

describe('Pipeline page', () => {
  it('renders header and pipeline when data exists', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: { name: 'Workflow X', status: 'running', orchestratorModel: 'gpt-4o' },
      isLoading: false,
      error: null,
    } as any);

    render(
      <MemoryRouter initialEntries={['/pipeline/wf-1']}>
        <Routes>
          <Route path="/pipeline/:workflowId" element={<Pipeline />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('orchestrator-header')).toBeInTheDocument();
    expect(screen.getByTestId('task-pipeline')).toBeInTheDocument();
  });
});
