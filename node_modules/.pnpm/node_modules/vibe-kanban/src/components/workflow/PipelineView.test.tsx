import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { PipelineView } from './PipelineView';
import type { Terminal } from './TerminalCard';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

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

  beforeEach(() => {
    void setTestLanguage();
  });

  it('should render workflow name and status badge', () => {
    renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="idle"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:pipeline.status.idle'))).toBeInTheDocument();
  });

  it('should render all tasks with their numbers and names', () => {
    renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText(i18n.t('workflow:pipeline.taskLabel', { index: 1 }))).toBeInTheDocument();
    expect(screen.getByText('Implement Authentication')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:pipeline.taskLabel', { index: 2 }))).toBeInTheDocument();
    expect(screen.getByText('Add Database Integration')).toBeInTheDocument();
  });

  it('should render git branch badges for each task', () => {
    renderWithI18n(
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
    const { container } = renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    const terminalCards = container.querySelectorAll('[class*="w-32"]');
    expect(terminalCards.length).toBeGreaterThan(0);
  });

  it('should render connector lines between terminals', () => {
    const { container } = renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    const connectors = container.querySelectorAll('.w-8.h-0\\.5.bg-muted\\/30');
    expect(connectors.length).toBe(1);
  });

  it('should render merge terminal with dashed border', () => {
    const { container } = renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
      />
    );

    const dashedBorder = container.querySelector('.border-dashed');
    expect(dashedBorder).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:pipeline.mergeTerminalRole'))).toBeInTheDocument();
  });

  it('should display correct status labels', () => {
    const statuses: PipelineViewProps['status'][] = [
      'idle',
      'running',
      'paused',
      'completed',
      'failed',
    ];

    const expectedLabels = {
      idle: i18n.t('workflow:pipeline.status.idle'),
      running: i18n.t('workflow:pipeline.status.running'),
      paused: i18n.t('workflow:pipeline.status.paused'),
      completed: i18n.t('workflow:pipeline.status.completed'),
      failed: i18n.t('workflow:pipeline.status.failed'),
    };

    statuses.forEach((status) => {
      const { unmount } = renderWithI18n(
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

    const { container } = renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
        onTerminalClick={onTerminalClick}
      />
    );

    const terminalCards = container.querySelectorAll<HTMLElement>('[class*="w-32"]');
    const terminalCard = terminalCards.item(0);
    terminalCard.click();
    expect(onTerminalClick).toHaveBeenCalledWith('task-1', 'terminal-1');
  });

  it('should call onMergeTerminalClick when merge terminal is clicked', () => {
    const onMergeTerminalClick = vi.fn();

    const { container } = renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="running"
        tasks={mockTasks}
        mergeTerminal={mockMergeTerminal}
        onMergeTerminalClick={onMergeTerminalClick}
      />
    );

    const dashedBorder = container.querySelector('.border-dashed');
    if (dashedBorder instanceof HTMLElement) {
      const terminalCard = dashedBorder.querySelector<HTMLElement>('[class*="w-32"]');
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

    const { container } = renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="idle"
        tasks={tasksWithSingleTerminal}
        mergeTerminal={mockMergeTerminal}
      />
    );

    const connectors = container.querySelectorAll('.w-8.h-0\\.5.bg-muted\\/30');
    expect(connectors.length).toBe(0);
  });

  it('should handle empty tasks array', () => {
    renderWithI18n(
      <PipelineView
        name="Test Workflow"
        status="idle"
        tasks={[]}
        mergeTerminal={mockMergeTerminal}
      />
    );

    expect(screen.getByText('Test Workflow')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:pipeline.status.idle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('workflow:pipeline.mergeTerminalRole'))).toBeInTheDocument();
  });
});

type PipelineViewProps = React.ComponentProps<typeof PipelineView>;
