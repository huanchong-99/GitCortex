import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock hooks before imports
vi.mock('@/hooks/useWorkflows', () => ({
  useWorkflow: vi.fn(),
}));

vi.mock('@/stores/terminalStore', () => ({
  useRecentTerminalOutput: vi.fn(() => []),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'terminalActivity.title': 'Terminal Activity',
        'terminalActivity.selectWorkflow': 'Select a workflow to view terminal activity.',
        'terminalActivity.loading': 'Loading terminal activity...',
        'terminalActivity.noTerminalsYet': 'No terminals yet.',
        'terminalActivity.noActive': 'No active terminals.',
        'terminalActivity.defaultLabel': 'Terminal',
      };
      if (opts?.count !== undefined && key === 'terminalActivity.active') {
        return `${opts.count} active`;
      }
      return translations[key] ?? key;
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...rest }: any) => <a href={to} {...rest}>{children}</a>,
}));

import { TerminalActivityPanel } from './TerminalActivityPanel';
import { useWorkflow } from '@/hooks/useWorkflows';

describe('TerminalActivityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and select-workflow message when no workflow selected', () => {
    vi.mocked(useWorkflow).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as any);

    render(<TerminalActivityPanel workflowId={null} />);
    expect(screen.getByText('Terminal Activity')).toBeInTheDocument();
    expect(
      screen.getByText('Select a workflow to view terminal activity.')
    ).toBeInTheDocument();
  });
});
