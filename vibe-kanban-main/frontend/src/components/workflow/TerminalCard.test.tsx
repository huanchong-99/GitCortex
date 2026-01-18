import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalCard, type Terminal } from './TerminalCard';

describe('TerminalCard', () => {
  const createMockTerminal = (overrides: Partial<Terminal> = {}): Terminal => ({
    id: 'terminal-1',
    orderIndex: 0,
    cliTypeId: 'claude-code',
    role: 'Developer',
    status: 'not_started',
    ...overrides,
  });

  describe('Status Display', () => {
    it('should display gray circle ○ for not_started status', () => {
      const terminal = createMockTerminal({ status: 'not_started' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('○')).toBeInTheDocument();
    });

    it('should display yellow circle ◐ for starting status', () => {
      const terminal = createMockTerminal({ status: 'starting' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('◐')).toBeInTheDocument();
    });

    it('should display blue circle ◑ for waiting status', () => {
      const terminal = createMockTerminal({ status: 'waiting' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('◑')).toBeInTheDocument();
    });

    it('should display green circle ● for working status', () => {
      const terminal = createMockTerminal({ status: 'working' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('should display green checkmark for completed status', () => {
      const terminal = createMockTerminal({ status: 'completed' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      // Check icon from lucide-react
      const checkIcon = container.querySelector('svg.lucide-check');
      expect(checkIcon).toBeInTheDocument();
    });

    it('should display red X for failed status', () => {
      const terminal = createMockTerminal({ status: 'failed' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      // X icon from lucide-react
      const xIcon = container.querySelector('svg.lucide-x');
      expect(xIcon).toBeInTheDocument();
    });
  });

  describe('Terminal Information Display', () => {
    it('should display terminal order index as T{index+1}', () => {
      const terminal = createMockTerminal({ orderIndex: 0 });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('T1')).toBeInTheDocument();
    });

    it('should display correct terminal order index for different indices', () => {
      const terminal = createMockTerminal({ orderIndex: 2 });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('T3')).toBeInTheDocument();
    });

    it('should display role name when provided', () => {
      const terminal = createMockTerminal({ role: 'Developer' });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('Developer')).toBeInTheDocument();
    });

    it('should display "Terminal" when no role is provided', () => {
      const terminal = createMockTerminal({ role: undefined });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });

    it('should display CLI type label from constants', () => {
      const terminal = createMockTerminal({ cliTypeId: 'claude-code' });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should display CLI type ID if not found in constants', () => {
      const terminal = createMockTerminal({ cliTypeId: 'unknown-cli' });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('unknown-cli')).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have w-32 width class', () => {
      const terminal = createMockTerminal();
      const { container } = render(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('w-32');
    });

    it('should have rounded-lg border-2 classes', () => {
      const terminal = createMockTerminal();
      const { container } = render(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('rounded-lg');
      expect(card.className).toContain('border-2');
    });

    it('should have hover:shadow-md class', () => {
      const terminal = createMockTerminal();
      const { container } = render(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('hover:shadow-md');
    });

    it('should have cursor-pointer class', () => {
      const terminal = createMockTerminal();
      const { container } = render(<TerminalCard terminal={terminal} />);

      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('cursor-pointer');
    });
  });

  describe('Interaction', () => {
    it('should call onClick handler when clicked', () => {
      const handleClick = vi.fn();
      const terminal = createMockTerminal();
      const { container } = render(
        <TerminalCard terminal={terminal} onClick={handleClick} />
      );

      const card = container.firstChild as HTMLElement;
      fireEvent.click(card);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should work without onClick handler', () => {
      const terminal = createMockTerminal();
      const { container } = render(<TerminalCard terminal={terminal} />);

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
      const { container } = render(<TerminalCard terminal={terminal} />);

      // Check that all elements are present
      expect(screen.getByText('●')).toBeInTheDocument();
      expect(screen.getByText('T1')).toBeInTheDocument();
      expect(screen.getByText('Developer')).toBeInTheDocument();
      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should apply text-lg to status icon', () => {
      const terminal = createMockTerminal({ status: 'not_started' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      const icon = screen.getByText('○');
      expect(icon.className).toContain('text-lg');
    });

    it('should apply text-xs to terminal order index', () => {
      const terminal = createMockTerminal();
      const { container } = render(<TerminalCard terminal={terminal} />);

      const orderIndex = screen.getByText('T1');
      expect(orderIndex.className).toContain('text-xs');
    });

    it('should apply text-sm font-medium to role name', () => {
      const terminal = createMockTerminal({ role: 'Developer' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      const role = screen.getByText('Developer');
      expect(role.className).toContain('text-sm');
      expect(role.className).toContain('font-medium');
    });

    it('should apply text-xs text-low to CLI type', () => {
      const terminal = createMockTerminal({ cliTypeId: 'claude-code' });
      const { container } = render(<TerminalCard terminal={terminal} />);

      const cliType = screen.getByText('Claude Code');
      expect(cliType.className).toContain('text-xs');
      expect(cliType.className).toContain('text-low');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty role string', () => {
      const terminal = createMockTerminal({ role: '' });
      render(<TerminalCard terminal={terminal} />);

      // Empty string is falsy, so should display "Terminal"
      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });

    it('should handle large order index', () => {
      const terminal = createMockTerminal({ orderIndex: 99 });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText('T100')).toBeInTheDocument();
    });

    it('should handle long role names', () => {
      const longRole = 'Senior Full Stack Developer Specialist';
      const terminal = createMockTerminal({ role: longRole });
      render(<TerminalCard terminal={terminal} />);

      expect(screen.getByText(longRole)).toBeInTheDocument();
    });
  });
});
