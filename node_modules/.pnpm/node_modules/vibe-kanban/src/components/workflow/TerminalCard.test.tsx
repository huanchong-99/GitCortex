import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { TerminalCard, type Terminal } from './TerminalCard';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

describe('TerminalCard', () => {
  const createMockTerminal = (overrides: Partial<Terminal> = {}): Terminal => ({
    id: 'terminal-1',
    orderIndex: 0,
    cliTypeId: 'claude-code',
    role: 'Developer',
    status: 'not_started',
    ...overrides,
  });

  beforeEach(() => {
    void setTestLanguage();
  });

  describe('Status Display', () => {
    it('should display dot for not_started status', () => {
      const terminal = createMockTerminal({ status: 'not_started' });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const statusWrapper = container.querySelector('div.flex.items-center.justify-center');
      expect(statusWrapper).toBeInTheDocument();
      expect(statusWrapper).toHaveClass('text-low');
      expect(statusWrapper?.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('should display dot for starting status', () => {
      const terminal = createMockTerminal({ status: 'starting' });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const statusWrapper = container.querySelector('div.flex.items-center.justify-center');
      expect(statusWrapper).toHaveClass('text-yellow-500');
      expect(statusWrapper?.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('should display dot for waiting status', () => {
      const terminal = createMockTerminal({ status: 'waiting' });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const statusWrapper = container.querySelector('div.flex.items-center.justify-center');
      expect(statusWrapper).toHaveClass('text-blue-500');
      expect(statusWrapper?.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('should display dot for working status', () => {
      const terminal = createMockTerminal({ status: 'working' });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const statusWrapper = container.querySelector('div.flex.items-center.justify-center');
      expect(statusWrapper).toHaveClass('text-green-500');
      expect(statusWrapper?.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
    });

    it('should display green checkmark for completed status', () => {
      const terminal = createMockTerminal({ status: 'completed' });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const checkIcon = container.querySelector('svg.lucide-check');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should display red X for failed status', () => {
      const terminal = createMockTerminal({ status: 'failed' });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const xIcon = container.querySelector('svg.lucide-x');
      expect(xIcon).toBeInTheDocument();
    });
  });

  describe('Terminal Information Display', () => {
    it('should display terminal order index as T{index+1}', () => {
      const terminal = createMockTerminal({ orderIndex: 0 });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(
        screen.getByText(i18n.t('workflow:terminalCard.orderLabel', { index: 1 }))
      ).toBeInTheDocument();
    });

    it('should display correct terminal order index for different indices', () => {
      const terminal = createMockTerminal({ orderIndex: 2 });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(
        screen.getByText(i18n.t('workflow:terminalCard.orderLabel', { index: 3 }))
      ).toBeInTheDocument();
    });

    it('should display role name when provided', () => {
      const terminal = createMockTerminal({ role: 'Developer' });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('Developer')).toBeInTheDocument();
    });

    it('should display default role when no role is provided', () => {
      const terminal = createMockTerminal({ role: undefined });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(
        screen.getByText(i18n.t('workflow:terminalCard.defaultRole'))
      ).toBeInTheDocument();
    });

    it('should display CLI type label from constants', () => {
      const terminal = createMockTerminal({ cliTypeId: 'claude-code' });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should display CLI type ID if not found in constants', () => {
      const terminal = createMockTerminal({ cliTypeId: 'unknown-cli' });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('unknown-cli')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have w-32 width class', () => {
      const terminal = createMockTerminal();
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('w-32');
    });

    it('should have rounded-lg border-2 classes', () => {
      const terminal = createMockTerminal();
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('rounded-lg');
      expect(card.className).toContain('border-2');
    });

    it('should have hover:shadow-md class', () => {
      const terminal = createMockTerminal();
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('hover:shadow-md');
    });

    it('should have cursor-pointer class', () => {
      const terminal = createMockTerminal();
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('cursor-pointer');
    });
  });

  describe('Interaction', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn();
      const terminal = createMockTerminal();
      const { container } = renderWithI18n(
        <TerminalCard terminal={terminal} onClick={handleClick} />
      );

      const card = container.firstChild as HTMLElement;
      fireEvent.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should work without onClick handler', () => {
      const terminal = createMockTerminal();
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(() => fireEvent.click(card)).not.toThrow();
    });
  });

  describe('Layout', () => {
    it('should display all information in correct order', () => {
      const terminal = createMockTerminal({
        orderIndex: 0,
        role: 'Developer',
        cliTypeId: 'claude-code',
        status: 'working',
      });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(container.querySelector('span[aria-hidden="true"]')).toBeInTheDocument();
      expect(
        screen.getByText(i18n.t('workflow:terminalCard.orderLabel', { index: 1 }))
      ).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should apply size-2 to status dot', () => {
      const terminal = createMockTerminal({ status: 'not_started' });
      const { container } = renderWithI18n(<TerminalCard terminal={terminal} />);

      const dot = container.querySelector('span[aria-hidden="true"]');
      expect(dot?.className).toContain('size-2');
    });

    it('should apply text-xs to terminal order index', () => {
      const terminal = createMockTerminal();
      renderWithI18n(<TerminalCard terminal={terminal} />);

      const orderIndex = screen.getByText(i18n.t('workflow:terminalCard.orderLabel', { index: 1 }));
      expect(orderIndex.className).toContain('text-xs');
    });

    it('should apply text-sm font-medium to role name', () => {
      const terminal = createMockTerminal({ role: 'Developer' });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      const role = screen.getByText('Developer');
      expect(role.className).toContain('text-sm');
      expect(role.className).toContain('font-medium');
    });

    it('should apply text-xs text-low to CLI type', () => {
      const terminal = createMockTerminal({ cliTypeId: 'claude-code' });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      const cliType = screen.getByText('Claude Code');
      expect(cliType.className).toContain('text-xs');
      expect(cliType.className).toContain('text-low');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty role string', () => {
      const terminal = createMockTerminal({ role: '' });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(screen.getByText(i18n.t('workflow:terminalCard.defaultRole'))).toBeInTheDocument();
    });

    it('should handle large order index', () => {
      const terminal = createMockTerminal({ orderIndex: 99 });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(
        screen.getByText(i18n.t('workflow:terminalCard.orderLabel', { index: 100 }))
      ).toBeInTheDocument();
    });

    it('should handle long role names', () => {
      const longRole = 'Senior Full Stack Developer Specialist';
      const terminal = createMockTerminal({ role: longRole });
      renderWithI18n(<TerminalCard terminal={terminal} />);

      expect(screen.getByText(longRole)).toBeInTheDocument();
    });
  });
});
