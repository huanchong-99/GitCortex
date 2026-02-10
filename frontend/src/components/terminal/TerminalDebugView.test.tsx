import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { forwardRef } from 'react';
import { TerminalDebugView } from './TerminalDebugView';
import type { Terminal } from '@/components/workflow/TerminalCard';
import type { WorkflowTask } from '@/components/workflow/PipelineView';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

const terminalEmulatorPropsSpy = vi.fn();
const fetchMock = vi.fn();

const createFetchOkResponse = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({}),
  }) as Response;

vi.mock('./TerminalEmulator', () => ({
  TerminalEmulator: forwardRef((props: { terminalId: string }, _ref) => {
    terminalEmulatorPropsSpy(props);
    return <div data-testid="terminal-emulator" data-terminal-id={props.terminalId} />;
  }),
}));

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
    terminalEmulatorPropsSpy.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(createFetchOkResponse());
    vi.stubGlobal('fetch', fetchMock);
    void setTestLanguage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
        expect(screen.getByTestId('terminal-emulator')).toBeInTheDocument();
      });
    });

    it('should rebuild terminal emulator when switching terminals', async () => {
      const switchableTasks: (WorkflowTask & { terminals: Terminal[] })[] = [
        {
          ...mockTasks[0],
          terminals: mockTasks[0].terminals.map((terminal) =>
            terminal.id === 'term-2' ? { ...terminal, status: 'working' } : terminal
          ),
        },
      ];

      renderWithI18n(<TerminalDebugView tasks={switchableTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      const reviewerButton = screen.getByText('Reviewer').closest('button');

      if (!devButton || !reviewerButton) {
        throw new Error('Expected terminal buttons to be rendered.');
      }

      fireEvent.click(devButton);

      await waitFor(() => {
        expect(screen.getByTestId('terminal-emulator')).toHaveAttribute('data-terminal-id', 'term-1');
      });

      const terminalIdsAfterFirstSelection = terminalEmulatorPropsSpy.mock.calls.map(
        (args) => args[0]?.terminalId as string
      );
      expect(terminalIdsAfterFirstSelection).toContain('term-1');
      expect(terminalIdsAfterFirstSelection).not.toContain('term-2');

      fireEvent.click(reviewerButton);

      await waitFor(() => {
        expect(screen.getByTestId('terminal-emulator')).toHaveAttribute('data-terminal-id', 'term-2');
      });

      const terminalIds = terminalEmulatorPropsSpy.mock.calls.map(
        (args) => args[0]?.terminalId as string
      );

      expect(terminalIds).toContain('term-1');
      expect(terminalIds).toContain('term-2');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should show starting placeholder when switching from working to not_started terminal', async () => {
      let resolveStartRequest: ((value: Response) => void) | null = null;
      fetchMock.mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveStartRequest = resolve;
          })
      );

      renderWithI18n(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      const reviewerButton = screen.getByText('Reviewer').closest('button');

      if (!devButton || !reviewerButton) {
        throw new Error('Expected terminal buttons to be rendered.');
      }

      fireEvent.click(devButton);

      await waitFor(() => {
        expect(screen.getByTestId('terminal-emulator')).toHaveAttribute('data-terminal-id', 'term-1');
        expect(screen.getByText('claude-code - model-1')).toBeInTheDocument();
      });

      fireEvent.click(reviewerButton);

      await waitFor(() => {
        expect(screen.getByText('cursor - model-2')).toBeInTheDocument();
        expect(screen.queryByText('claude-code - model-1')).not.toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:terminalDebug.starting'))).toBeInTheDocument();
        expect(screen.queryByTestId('terminal-emulator')).not.toBeInTheDocument();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith('/api/terminals/term-2/start', { method: 'POST' });

      if (!resolveStartRequest) {
        throw new Error('Expected terminal start request to be pending.');
      }

      resolveStartRequest(createFetchOkResponse());

      await waitFor(() => {
        expect(screen.getByTestId('terminal-emulator')).toHaveAttribute('data-terminal-id', 'term-2');
        expect(screen.queryByText(i18n.t('workflow:terminalDebug.starting'))).not.toBeInTheDocument();
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
