import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Step5Commands } from './Step5Commands';
import type { CommandConfig } from '../types';
import { renderWithI18n, setTestLanguage, i18n } from '@/test/renderWithI18n';

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

  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    await setTestLanguage();
  });

  describe('Rendering', () => {
    it('should render enable/disable radio buttons', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderWithI18n(<Step5Commands {...defaultProps} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      expect(screen.getByText(i18n.t('workflow:step5.title'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('workflow:step5.enableLabel'))).toBeInTheDocument();
      expect(screen.getByText(i18n.t('workflow:step5.disableLabel'))).toBeInTheDocument();
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should show enabled radio checked when config.enabled is true', async () => {
      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      const enabledRadio = screen.getByRole('radio', {
        name: i18n.t('workflow:step5.enableLabel'),
      });
      expect(enabledRadio).toBeChecked();
    });

    it('should show disabled radio checked when config.enabled is false', async () => {
      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: false }} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      const disabledRadio = screen.getByRole('radio', {
        name: i18n.t('workflow:step5.disableLabel'),
      });
      expect(disabledRadio).toBeChecked();
    });

    it('should not show command list when disabled', async () => {
      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: false }} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      expect(
        screen.queryByText(i18n.t('workflow:step5.selectedTitle'))
      ).not.toBeInTheDocument();
    });

    it('should show command list when enabled', async () => {
      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.selectedTitle'))).toBeInTheDocument();
      });
    });

    it('should show empty state when no commands selected', async () => {
      renderWithI18n(
        <Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true, presetIds: [] }} />
      );

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.selectedEmpty'))).toBeInTheDocument();
      });
    });

    it('should show system presets section', async () => {
      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.systemPresetsTitle'))).toBeInTheDocument();
      });
    });

    it('should show user presets section', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 'user-1',
            name: 'user-preset',
            displayName: 'User Preset',
            description: 'User preset',
            isSystem: false,
          },
        ]),
      });

      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.userPresetsTitle'))).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    it('should call onUpdate when enabling commands', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(<Step5Commands {...defaultProps} onUpdate={onUpdate} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      const enabledRadio = screen.getByRole('radio', {
        name: i18n.t('workflow:step5.enableLabel'),
      });
      fireEvent.click(enabledRadio);

      expect(onUpdate).toHaveBeenCalledWith({ enabled: true });
    });

    it('should call onUpdate when disabling commands', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
      const disabledRadio = screen.getByRole('radio', {
        name: i18n.t('workflow:step5.disableLabel'),
      });
      fireEvent.click(disabledRadio);

      expect(onUpdate).toHaveBeenCalledWith({ enabled: false, presetIds: [] });
    });

    it('should add preset when clicking add button', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.presets.writeCode.name'))).toBeInTheDocument();
      });

      const addButtons = screen.getAllByLabelText(i18n.t('workflow:step5.add'));
      fireEvent.click(addButtons[0]);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['write-code'] });
    });

    it('should remove preset when clicking remove button', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('workflow:step5.presets.writeCode.name'))).toHaveLength(2);
      });

      const removeButtons = screen.getAllByLabelText(i18n.t('workflow:step5.remove'));
      fireEvent.click(removeButtons[0]);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['review'] });
    });

    it('should clear all presets when clicking Clear All button', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.clearAll'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18n.t('workflow:step5.clearAll')));

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: [] });
    });

    it('should reset to defaults when clicking Reset Default button', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review', 'test'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.resetDefault'))).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(i18n.t('workflow:step5.resetDefault')));

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['write-code', 'review'] });
    });

    it('should move preset up when clicking move up button', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review', 'test'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('workflow:step5.presets.review.name'))).toHaveLength(2);
      });

      const moveUpButtons = screen.getAllByLabelText(i18n.t('workflow:step5.moveUp'));
      fireEvent.click(moveUpButtons[1]);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['review', 'write-code', 'test'] });
    });

    it('should move preset down when clicking move down button', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code', 'review', 'test'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('workflow:step5.presets.writeCode.name'))).toHaveLength(2);
      });

      const moveDownButtons = screen.getAllByLabelText(i18n.t('workflow:step5.moveDown'));
      fireEvent.click(moveDownButtons[0]);

      expect(onUpdate).toHaveBeenCalledWith({ presetIds: ['review', 'write-code', 'test'] });
    });

    it('should not add duplicate presets', async () => {
      const onUpdate = vi.fn();
      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true, presetIds: ['write-code'] }}
          onUpdate={onUpdate}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText(i18n.t('workflow:step5.presets.writeCode.name'))).toHaveLength(2);
      });

      const addButtons = screen.getAllByLabelText(i18n.t('workflow:step5.add'));
      fireEvent.click(addButtons[0]);

      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('System Presets', () => {
    it('should have 5 system presets', async () => {
      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.presets.writeCode.name'))).toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:step5.presets.review.name'))).toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:step5.presets.fixIssues.name'))).toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:step5.presets.test.name'))).toBeInTheDocument();
        expect(screen.getByText(i18n.t('workflow:step5.presets.refactor.name'))).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    it('should fetch user presets on mount', async () => {
      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/workflows/presets/commands');
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'));

      renderWithI18n(<Step5Commands {...defaultProps} config={{ ...mockConfig, enabled: true }} />);

      await waitFor(() => {
        expect(screen.getByText(i18n.t('workflow:step5.systemPresetsTitle'))).toBeInTheDocument();
      });
    });

    it('should call onError when presets fetch fails', async () => {
      const onError = vi.fn();
      mockFetch.mockRejectedValueOnce(new Error('API Error'));

      renderWithI18n(
        <Step5Commands
          {...defaultProps}
          config={{ ...mockConfig, enabled: true }}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});
