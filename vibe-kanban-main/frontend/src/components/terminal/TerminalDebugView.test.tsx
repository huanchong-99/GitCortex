import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TerminalDebugView } from './TerminalDebugView';
import type { Terminal, WorkflowTask } from '@/shared/types';

// Mock xterm
vi.mock('@xterm/xterm', () => {
  class MockTerminal {
    onData: any;
    open: any;
    write: any;
    clear: any;
    dispose: any;
    loadAddon: any;
    cols = 80;
    rows = 24;

    constructor(options: any) {
      this.onData = vi.fn();
      this.open = vi.fn();
      this.write = vi.fn();
      this.clear = vi.fn();
      this.dispose = vi.fn();
      this.loadAddon = vi.fn();
    }
  }
  return { Terminal: MockTerminal };
});

// Mock FitAddon
vi.mock('@xterm/addon-fit', () => {
  class MockFitAddon {
    fit: any;
    constructor() {
      this.fit = vi.fn();
    }
  }
  return { FitAddon: MockFitAddon };
});

// Mock WebSocket
class MockWebSocket {
  url = '';
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    // Mock send
  }

  close() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }

  addEventListener(_: string, handler: () => void) {
    if (_ === 'open') this.onopen = handler;
  }
}

global.WebSocket = MockWebSocket as any;

const mockTerminals: Terminal[] = [
  {
    id: 'term-1',
    workflow_task_id: 'task-1',
    cli_type_id: 'claude-code',
    model_config_id: 'model-1',
    role: 'Developer',
    order_index: 0,
    status: 'working',
    process_id: null,
    pty_session_id: null,
  },
  {
    id: 'term-2',
    workflow_task_id: 'task-1',
    cli_type_id: 'cursor',
    model_config_id: 'model-2',
    role: 'Reviewer',
    order_index: 1,
    status: 'not_started',
    not_started: null,
    pty_session_id: null,
  },
];

const mockTasks: Array<WorkflowTask & { terminals: Terminal[] }> = [
  {
    id: 'task-1',
    workflow_id: 'wf-1',
    name: 'Implementation Task',
    description: 'Implement feature',
    order_index: 0,
    status: 'running',
    terminals: mockTerminals,
  },
];

describe('TerminalDebugView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render terminal list sidebar', () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getByText('终端列表')).toBeInTheDocument();
    });

    it('should render all terminals in the list', () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Reviewer')).toBeInTheDocument();
    });

    it('should show "select a terminal" message when no terminal selected', () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getByText('选择一个终端开始调试')).toBeInTheDocument();
    });
  });

  describe('Terminal Selection', () => {
    it('should select terminal when clicked', async () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      fireEvent.click(devButton!);

      await waitFor(() => {
        expect(screen.getByText('claude-code - model-1')).toBeInTheDocument();
      });
    });

    it('should highlight selected terminal', async () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const devButton = screen.getByText('Developer').closest('button');
      fireEvent.click(devButton!);

      await waitFor(() => {
        const selectedButton = devButton;
        expect(selectedButton).toHaveClass('bg-primary');
      });
    });
  });

  describe('Terminal Status Display', () => {
    it('should display status dot with correct color', () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      const workingTerminal = screen.getByText('working');
      expect(workingTerminal).toBeInTheDocument();
    });

    it('should show task name for each terminal', () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);
      expect(screen.getAllByText('Implementation Task')).toHaveLength(2);
    });
  });

  describe('Terminal View Panel', () => {
    it('should render terminal info when selected', async () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      fireEvent.click(screen.getByText('Developer').closest('button')!);

      await waitFor(() => {
        expect(screen.getAllByText('Developer')).toHaveLength(2);
        expect(screen.getByText(/claude-code/)).toBeInTheDocument();
      });
    });

    it('should render TerminalEmulator when terminal selected', async () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      fireEvent.click(screen.getByText('Developer').closest('button')!);

      await waitFor(() => {
        const container = document.querySelector('.bg-\\[\\#1e1e1e\\]');
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Control Buttons', () => {
    it('should render control buttons when terminal selected', async () => {
      render(<TerminalDebugView tasks={mockTasks} wsUrl="ws://localhost:8080" />);

      fireEvent.click(screen.getByText('Developer').closest('button')!);

      await waitFor(() => {
        expect(screen.getByText('清空')).toBeInTheDocument();
        expect(screen.getByText('重启')).toBeInTheDocument();
      });
    });
  });
});
