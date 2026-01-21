import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { TerminalDebugView } from './TerminalDebugView';
import type { Terminal } from '@/components/workflow/TerminalCard';
import type { WorkflowTask } from '@/components/workflow/PipelineView';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    onData = vi.fn<(handler: (data: string) => void) => void>();
    open = vi.fn<(container: HTMLElement) => void>();
    write = vi.fn<(data: string) => void>();
    clear = vi.fn<() => void>();
    dispose = vi.fn<() => void>();
    loadAddon = vi.fn<(addon: unknown) => void>();
    cols = 80;
    rows = 24;
  }
  return { Terminal: MockTerminal };
});

vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit = vi.fn<() => void>();
  }
  return { FitAddon: MockFitAddon };
});

class MockWebSocket {
  url = '';
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }

  send() {
    // Mock send
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  addEventListener(event: string, handler: () => void) {
    if (event === 'open') this.onopen = handler;
  }
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

const mockTerminals: Terminal[] = [
  {
    id: 'term-1',
    workflowTaskId: 'task-1',
    cliTypeId: 'claude-code',
    modelConfigId: 'model-1',
    role: 'Developer',
    orderIndex: 0,
    status: 'working',
    processId: null,
    ptySessionId: null,
  },
  {
    id: 'term-2',
    workflowTaskId: 'task-1',
    cliTypeId: 'cursor',
    modelConfigId: 'model-2',
    role: 'Reviewer',
    orderIndex: 1,
    status: 'not_started',
    processId: null,
    ptySessionId: null,
  },
];

const mockTasks: (WorkflowTask & { terminals: Terminal[] })[] = [
  {
    id: 'task-1',
    name: 'Implementation Task',
    branch: 'feature/implementation',
    terminals: mockTerminals,
  },
];

describe('TerminalDebugView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    void setTestLanguage();
  });

  describe('Rendering', () => {
    it('should render terminal list sidebar', () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getByText(i18n.t('workflow:terminalDebug.listTitle'))).toBeInTheDocument();
    });

    it('should render all terminals in the list', () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Reviewer')).toBeInTheDocument();
    });

    it('should show select terminal message when no terminal selected', () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getByText(i18n.t('workflow:terminalDebug.selectPrompt'))).toBeInTheDocument();
    });
  });

  describe('Terminal Selection', () => {
    it('should select terminal when clicked', async () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      if (!devButton) {
        throw new Error('Expected terminal button to be rendered.');
      }
      fireEvent.click(devButton);

      await waitFor(() => {
        expect(screen.getByText('claude-code - model-1')).toBeInTheDocument();
      });
    });

    it('should highlight selected terminal', async () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      if (!devButton) {
        throw new Error('Expected terminal button to be rendered.');
      }
      fireEvent.click(devButton);

      await waitFor(() => {
        expect(devButton).toHaveClass('bg-primary');
      });
    });
  });

  describe('Terminal Status Display', () => {
    it('should display status dot with correct label', () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const workingLabel = i18n.t('workflow:terminalDebug.status.working');
      expect(screen.getByText(workingLabel)).toBeInTheDocument();
    });

    it('should show task name for each terminal', () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getAllByText('Implementation Task')).toHaveLength(2);
    });
  });

  describe('Terminal View Panel', () => {
    it('should render terminal info when selected', async () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      if (!devButton) {
        throw new Error('Expected terminal button to be rendered.');
      }
      fireEvent.click(devButton);

      await waitFor(() => {
        expect(screen.getAllByText('Developer')).toHaveLength(2);
        expect(screen.getByText(/claude-code/)).toBeInTheDocument();
      });
    });

    it('should render TerminalEmulator when terminal selected', async () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      if (!devButton) {
        throw new Error('Expected terminal button to be rendered.');
      }
      fireEvent.click(devButton);

      await waitFor(() => {
        const container = document.querySelector('.bg-\\[\\#1e1e1e\\]');
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Control Buttons', () => {
    it('should render control buttons when terminal selected', async () => {
      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      if (!devButton) {
        throw new Error('Expected terminal button to be rendered.');
      }
      fireEvent.click(devButton);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:terminalDebug.clear'))).toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:terminalDebug.restart'))).toBeInTheDocument();
      });
    });
  });
});
