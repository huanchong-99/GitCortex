import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Step5Commands } from './Step5Commands';
import type { CommandConfig } from '../types';

// Mock fetch API
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Step5Commands', () => {
  const mockConfig: CommandConfig = {
    enabled: false,
    presetIds: [],
  };

  const defaultProps = {
    config: mockConfig,
    errors: {},
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API response
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  describe('Rendering', () => {
    it('should render enable/disable radio buttons', () => {
      render(<Step5Commands {...defaultProps} />);

      expect(screen.getByText('启用斜杠命令')).toBeInTheDocument();
      expect(screen.getByText('不启用')).toBeInTheDocument();
    });

    it('should show enabled radio checked when config.enabled is true', () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      const enabledRadio = screen.getByRole('radio', { name: /启用斜杠命令/ });
      expect(enabledRadio).toBeChecked();
    });

    it('should show disabled radio checked when config.enabled is false', () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: false }} />);

      const disabledRadio = screen.getByRole('radio', { name: /不启用/ });
      expect(disabledRadio).toBeChecked();
    });

    it('should not show command list when disabled', () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: false }} />);

      expect(screen.queryByText('已选命令 (按执行顺序排列)')).not.toBeInTheDocument();
    });

    it('should show command list when enabled', async () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText('已选命令 (按执行顺序排列)')).toBeInTheDocument();
      });
    });

    it('should show empty state when no commands selected', async () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true, presetIds: [] }} />);

      await waitFor(() => {
        expect(screen.getByText(/暂未选择任何命令/)).toBeInTheDocument();
      });
    });

    it('should show system presets section', async () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText('系统预设')).toBeInTheDocument();
      });
    });

    it('should show user presets section', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          { id: 'user-1', name: 'user-preset', displayName: 'User Preset', description: 'User preset', isSystem: false },
        ],
      });

      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText('用户预设')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onUpdate when enabling commands', () => {
      const onUpdate = vi.fn();
      render(<Step5Commands {...defaultProps} onUpdate={onUpdate} />);

      const enabledRadio = screen.getByRole('radio', { name: /启用斜杠命令/ });
      fireEvent.click(enabledRadio);

      expect(onUpdate).toHaveBeenCalledWith({ enabled: true });
    });

    it('should call onUpdate when disabling commands', () => {
      const onUpdate = vi.fn();
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} onUpdate={onUpdate} />);

      const disabledRadio = screen.getByRole('radio', { name: /不启用/ });
      fireEvent.click(disabledRadio);

      expect(onUpdate).toHaveBeenCalledWith({ enabled: false, presetIds: [] });
    });

    it('should add preset when clicking add button', async () => {
      const onUpdate = vi.fn();
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} onUpdate={onUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('编写代码')).toBeInTheDocument();
      });

      // Find the add button in the first system preset (write-code)
      const addButtons = screen.getAllByLabelText('添加');
      fireEvent.click(addButtons[0]);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['write-code'] });
    });

    it('should remove preset when clicking remove button', async () => {
      const onUpdate = vi.fn();
      render(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('编写代码')).toHaveLength(2); // One in selected, one in available
      });

      const removeButtons = screen.getAllByLabelText('移除');
      fireEvent.click(removeButtons[0]);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['review'] });
    });

    it('should clear all presets when clicking Clear All button', async () => {
      const onUpdate = vi.fn();
      render(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('清除全部')).toBeInTheDocument();
      });

      const clearButton = screen.getByText('清除全部');
      fireEvent.click(clearButton);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: [] });
    });

    it('should reset to defaults when clicking Reset Default button', async () => {
      const onUpdate = vi.fn();
      render(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review', 'test'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('重置默认')).toBeInTheDocument();
      });

      const resetButton = screen.getByText('重置默认');
      fireEvent.click(resetButton);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['write-code', 'review'] });
    });

    it('should move preset up when clicking move up button', async () => {
      const onUpdate = vi.fn();
      render(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review', 'test'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('代码审查')).toHaveLength(2); // One in selected, one in available
      });

      const moveUpButtons = screen.getAllByLabelText('上移');
      fireEvent.click(moveUpButtons[1]); // Move 'review' up

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['review', 'write-code', 'test'] });
    });

    it('should move preset down when clicking move down button', async () => {
      const onUpdate = vi.fn();
      render(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review', 'test'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('编写代码')).toHaveLength(2); // One in selected, one in available
      });

      const moveDownButtons = screen.getAllByLabelText('下移');
      fireEvent.click(moveDownButtons[0]); // Move 'write-code' down

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['review', 'write-code', 'test'] });
    });

    it('should not add duplicate presets', async () => {
      const onUpdate = vi.fn();
      render(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText('编写代码')).toHaveLength(2); // One in selected, one in available
      });

      const addButtons = screen.getAllByLabelText('添加');
      fireEvent.click(addButtons[0]);

      // Should not add duplicate - onUpdate should not be called
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('System Presets', () => {
    it('should have 5 system presets', async () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText('编写代码')).toBeInTheDocument();
        expect(screen.getByText('代码审查')).toBeInTheDocument();
        expect(screen.getByText('修复问题')).toBeInTheDocument();
        expect(screen.getByText('运行测试')).toBeInTheDocument();
        expect(screen.getByText('代码重构')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch user presets on mount', async () => {
      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/workflows/presets/commands');
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      render(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      // Should still render system presets even if API fails
      await waitFor(() => {
        expect(screen.getByText('系统预设')).toBeInTheDocument();
      });
    });
  });
});
