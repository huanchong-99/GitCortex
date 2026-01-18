import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineView } from './PipelineView';
import type { Terminal } from './TerminalCard';

describe('PipelineView', () => {
  const mockTasks = [
    {
      id: 'task-1',
      name: 'Implement Authentication',
      branch: 'feat/auth',
      terminals: [
        {
          id: 'terminal-1',
          orderIndex: 0,
          cliTypeId: 'claude-code',
          role: 'Developer',
          status: 'completed' as Terminal['status'],
        },
        {
          id: 'terminal-2',
          orderIndex: 1,
          cliTypeId: 'gemini-cli',
          role: 'Reviewer',
          status: 'working' as Terminal['status'],
        },
      ],
    },
    {
      id: 'task-2',
      name: 'Add Database Integration',
      branch: 'feat/database',
      terminals: [
        {
          id: 'terminal-3',
          orderIndex: 0,
          cliTypeId: 'codex',
          role: 'DB Expert',
          status: 'not_started' as Terminal['status'],
        },
      ],
    },
  ];

  const mockMergeTerminal = {
    cliTypeId: 'claude-code',
    modelConfigId: 'model-1',
    status: 'not_started' as Terminal['status'],
  };

  it('should render workflow name and status badge', () => {
    render(
      <PipelineView
        name="Test Workflow"
        status="idle"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('未开始')).toBeInTheDocument();
  });

  it('should render all tasks with their numbers and names', () => {
    render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Implement Authentication')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Add Database Integration')).toBeInTheDocument();
  });

  it('should render git branch badges for each task', () => {
    render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText('feat/auth')).toBeInTheDocument();
    expect(screen.getByText('feat/database')).toBeInTheDocument();
  });

  it('should display terminals horizontally for each task', () => {
    const { container } = render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    // Check that terminals are rendered
    const terminalCards = container.querySelectorAll('[class*="w-32"]');
    expect(terminalCards.length).toBeGreaterThan(0);
  });

  it('should render connector lines between terminals', () => {
    const { container } = render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    // Check for connector lines (w-8 h-0.5 bg-muted/30)
    const connectors = container.querySelectorAll('.w-8.h-0\\.5.bg-muted\\/30');
    // First task has 2 terminals, so should have 1 connector
    expect(connectors.length).toBe(1);
  });

  it('should render merge terminal with dashed border', () => {
    const { container } = render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    // Check for dashed border container
    const dashedBorder = container.querySelector('.border-dashed');
    expect(dashedBorder).toBeInTheDocument();
    expect(screen.getByText('Merge Terminal')).toBeInTheDocument();
  });

  it('should display correct status labels', () => {
    const statuses: Array<PipelineViewProps['status']> = [
      'idle',
      'running',
      'paused',
      'completed',
      'failed',
    ];

    const expectedLabels = {
      idle: '未开始',
      running: '运行中',
      paused: '已暂停',
      completed: '已完成',
      failed: '失败',
    };

    statuses.forEach((status) => {
      const { unmount } = render(
        <PipelineView
          name="Test Workflow"
          status={status}
          tasks={mockTasks}
          mergeTerminal={mockMergeTerminal}
        />
      );

      expect(screen.getByText(expectedLabels[status])).toBeInTheDocument();
      unmount();
    });
  });

  it('should call onTerminalClick when terminal is clicked', () => {
    const onTerminalClick = vi.fn();

    const { container } = render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
        onTerminalClick={onTerminalClick}
      />
    );

    // Click on the first terminal card
    const terminalCards = container.querySelectorAll('[class*="w-32"]');
    if (terminalCards[0]) {
      terminalCards[0].click();
      expect(onTerminalClick).toHaveBeenCalledWith('task-1', 'terminal-1');
    }
  });

  it('should call onMergeTerminalClick when merge terminal is clicked', () => {
    const onMergeTerminalClick = vi.fn();

    const { container } = render(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
        onMergeTerminalClick={onMergeTerminalClick}
      />
    );

    // Click on the merge terminal card inside the dashed border
    const dashedBorder = container.querySelector('.border-dashed');
    if (dashedBorder) {
      const terminalCard = dashedBorder.querySelector('[class*="w-32"]');
      if (terminalCard) {
        terminalCard.click();
        expect(onMergeTerminalClick).toHaveBeenCalled();
      }
    }
  });

  it('should handle tasks with single terminal (no connectors)', () => {
    const tasksWithSingleTerminal = [
      {
        id: 'task-1',
        name: 'Single Terminal Task',
        branch: 'feat/single',
        terminals: [
          {
            id: 'terminal-1',
            orderIndex: 0,
            cliTypeId: 'claude-code',
            status: 'not_started' as Terminal['status'],
          },
        ],
      },
    ];

    const { container } = render(
      <PipelineView
        name="Test Workflow"
        status="idle"
        tasks={tasksWithSingleTerminal}
        mergeTerminal={mockMergeTerminal}
      />
    );

    // Should not have any connectors
    const connectors = container.querySelectorAll('.w-8.h-0\\.5.bg-muted\\/30');
    expect(connectors.length).toBe(0);
  });

  it('should handle empty tasks array', () => {
    const { container } = render(
      <PipelineView
        name="Test Workflow"
        status="idle"
        tasks={[]}
        mergeTerminal={mockMergeTerminal}
      />
    );

    // Should still render workflow name and status
    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText('未开始')).toBeInTheDocument();

    // Should still render merge terminal
    expect(screen.getByText('Merge Terminal')).toBeInTheDocument();
  });
});

type PipelineViewProps = React.ComponentProps<typeof PipelineView>;
