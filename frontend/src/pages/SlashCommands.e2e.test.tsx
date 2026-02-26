/**
 * End-to-End Tests for Slash Commands
 *
 * These tests simulate complete user workflows for slash command management:
 * 1. Create a new slash command preset
 * 2. Edit an existing preset
 * 3. Delete a preset
 * 4. Integrate commands into workflow
 * 5. Custom parameters editing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { SlashCommands } from './SlashCommands';
import { Step5Commands } from '@/components/workflow/steps/Step5Commands';
import type { SlashCommandPresetDto } from 'shared/types';
import { I18nextProvider } from 'react-i18next';
import { i18n } from '@/test/renderWithI18n';

// ============================================================================
// Test Utilities
// ============================================================================

const createMockQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

const wrapper = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={createMockQueryClient()}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  </I18nextProvider>
);

const mockPresets: SlashCommandPresetDto[] = [
  {
    id: 'preset-1',
    command: '/review',
    description: 'Review code changes',
    promptTemplate: 'Review the following code changes: {{code_path}}',
    isSystem: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'preset-2',
    command: '/test',
    description: 'Run tests',
    promptTemplate: 'Run tests for {{module}} with coverage {{coverage}}',
    isSystem: false,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

// ============================================================================
// E2E Test Scenarios
// ============================================================================

describe('Slash Commands E2E: User Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Create New Slash Command', () => {
    it('should complete full creation workflow', async () => {
      const user = userEvent.setup();

      // Mock API responses
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Wait for page to load
      await waitFor(() => {
        expect(screen.getByText('Slash Commands')).toBeInTheDocument();
      });

      // Click "Create Slash Command" button
      const createButton = screen.getByText('Create Slash Command');
      await user.click(createButton);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText(/Create Slash Command/)).toBeInTheDocument();
      });

      // Fill in the form
      const commandInput = screen.getByLabelText(/Command/i);
      const descriptionInput = screen.getByLabelText(/Description/i);
      const templateInput = screen.getByLabelText(/Prompt Template/i);

      await user.type(commandInput, '/deploy');
      await user.type(descriptionInput, 'Deploy application');
      await user.type(templateInput, 'Deploy {{service}} to {{env}}');

      // Submit the form
      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      // Verify success (dialog closes, new item appears)
      await waitFor(() => {
        expect(screen.queryByText(/Create Slash Command/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Scenario 2: Edit Existing Command', () => {
    it('should complete full edit workflow', async () => {
      const user = userEvent.setup();

      // Mock API with existing presets
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockPresets }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Wait for commands to load
      await waitFor(() => {
        expect(screen.getByText('/review')).toBeInTheDocument();
      });

      // Click edit button for first command
      const editButtons = screen.getAllByLabelText(/Edit/i);
      await user.click(editButtons[0]);

      // Wait for edit dialog
      await waitFor(() => {
        expect(screen.getByText(/Edit Slash Command/)).toBeInTheDocument();
      });

      // Update description
      const descriptionInput = screen.getByLabelText(/Description/i);
      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'Review code changes thoroughly');

      // Submit changes
      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Verify dialog closes
      await waitFor(() => {
        expect(screen.queryByText(/Edit Slash Command/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Scenario 3: Delete Command with Confirmation', () => {
    it('should complete full delete workflow', async () => {
      const user = userEvent.setup();

      // Mock API
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockPresets }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Wait for commands to load
      await waitFor(() => {
        expect(screen.getByText('/review')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByLabelText(/Delete/i);
      await user.click(deleteButtons[0]);

      // Wait for confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmButton = screen.getByText('Delete');
      await user.click(confirmButton);

      // Verify dialog closes
      await waitFor(() => {
        expect(screen.queryByText(/Are you sure/i)).not.toBeInTheDocument();
      });
    });
  });
});

describe('Workflow Integration E2E: Step5Commands', () => {
  describe('Scenario 4: Select Commands for Workflow', () => {
    it('should complete command selection workflow', async () => {
      const user = userEvent.setup();

      // Mock presets API
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: mockPresets }),
        } as Response)
      ));

      const mockOnChange = vi.fn();

      render(
        <Step5Commands
          value={[]}
          onChange={mockOnChange}
          presets={mockPresets}
        />,
        { wrapper }
      );

      // Wait for presets to load
      await waitFor(() => {
        expect(screen.getByText(/review code changes/i)).toBeInTheDocument();
      });

      // Select first command
      const checkbox1 = screen.getByLabelText(/review code changes/i);
      await user.click(checkbox1);

      // Verify onChange was called
      expect(mockOnChange).toHaveBeenCalled();

      // Select second command
      const checkbox2 = screen.getByLabelText(/run tests/i);
      await user.click(checkbox2);

      // Both commands should be selected
      expect(checkbox1).toBeChecked();
      expect(checkbox2).toBeChecked();
    });
  });

  describe('Scenario 5: Edit Custom Parameters', () => {
    it('should complete custom params editing workflow', async () => {
      const user = userEvent.setup();

      const mockValue = [
        {
          presetId: 'preset-1',
          customParams: '{"code_path": "src/main.rs"}',
        },
      ];

      const mockOnChange = vi.fn();

      render(
        <Step5Commands
          value={mockValue}
          onChange={mockOnChange}
          presets={mockPresets}
        />,
        { wrapper }
      );

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText(/review code changes/i)).toBeInTheDocument();
      });

      // Click "Edit Params" button
      const editParamsButton = screen.getByText('Edit Params');
      await user.click(editParamsButton);

      // Wait for params modal
      await waitFor(() => {
        expect(screen.getByText(/Edit Custom Parameters/i)).toBeInTheDocument();
      });

      // Verify current params are displayed
      const textArea = screen.getByRole('textbox');
      expect(textArea).toHaveValue('{"code_path": "src/main.rs"}');

      // Edit params
      await user.clear(textArea);
      await user.type(textArea, '{"code_path": "src/lib.rs", "strict": true}');

      // Save (Ctrl+Enter)
      await user.keyboard('{Control>}{Enter}{/Control}');

      // Verify modal closes and params are updated
      await waitFor(() => {
        expect(screen.queryByText(/Edit Custom Parameters/i)).not.toBeInTheDocument();
      });

      // Verify onChange was called with updated params
      expect(mockOnChange).toHaveBeenCalledWith([
        {
          presetId: 'preset-1',
          customParams: '{"code_path": "src/lib.rs", "strict": true}',
        },
      ]);
    });

    it('should show validation error for invalid JSON', async () => {
      const user = userEvent.setup();

      const mockValue = [
        {
          presetId: 'preset-1',
          customParams: '{}',
        },
      ];

      const mockOnChange = vi.fn();

      render(
        <Step5Commands
          value={mockValue}
          onChange={mockOnChange}
          presets={mockPresets}
        />,
        { wrapper }
      );

      await waitFor(() => {
        expect(screen.getByText(/review code changes/i)).toBeInTheDocument();
      });

      // Click "Edit Params" button
      const editParamsButton = screen.getByText('Edit Params');
      await user.click(editParamsButton);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText(/Edit Custom Parameters/i)).toBeInTheDocument();
      });

      // Enter invalid JSON
      const textArea = screen.getByRole('textbox');
      await user.clear(textArea);
      await user.type(textArea, '{invalid json}');

      // Try to save (Ctrl+Enter)
      await user.keyboard('{Control>}{Enter}{/Control}');

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/Invalid JSON/i)).toBeInTheDocument();
      });

      // Modal should not close
      expect(screen.getByText(/Edit Custom Parameters/i)).toBeInTheDocument();

      // Fix the JSON
      await user.clear(textArea);
      await user.type(textArea, '{"valid": "json"}');

      // Save again
      await user.keyboard('{Control>}{Enter}{/Control}');

      // Should succeed and close modal
      await waitFor(() => {
        expect(screen.queryByText(/Edit Custom Parameters/i)).not.toBeInTheDocument();
      });
    });
  });
});

describe('E2E: Real-World User Scenarios', () => {
  describe('Scenario 6: Complete Workflow Setup', () => {
    it('should simulate setting up a workflow with commands', async () => {
      const user = userEvent.setup();

      // Step 1: Navigate to slash commands page
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Slash Commands')).toBeInTheDocument();
      });

      // Step 2: Create a new command
      const createButton = screen.getByText('Create Slash Command');
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Create Slash Command/)).toBeInTheDocument();
      });

      const commandInput = screen.getByLabelText(/Command/i);
      const descriptionInput = screen.getByLabelText(/Description/i);
      const templateInput = screen.getByLabelText(/Prompt Template/i);

      await user.type(commandInput, '/analyze');
      await user.type(descriptionInput, 'Analyze code quality');
      await user.type(templateInput, 'Analyze {{file_path}} for code quality issues');

      const submitButton = screen.getByText('Create');
      await user.click(submitButton);

      // Step 3: Verify command was created
      await waitFor(() => {
        expect(screen.queryByText(/Create Slash Command/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Scenario 7: Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock API error
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ success: false, message: 'Server error' }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/Failed to load slash commands/i)).toBeInTheDocument();
      });
    });
  });

  describe('Scenario 8: Empty State Guidance', () => {
    it('should guide users to create first command', async () => {
      const user = userEvent.setup();

      // Mock empty response
      vi.stubGlobal('fetch', vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: [] }),
        } as Response)
      ));

      render(<SlashCommands />, { wrapper });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText(/No slash commands yet/i)).toBeInTheDocument();
      });

      // Create button should be prominent
      const createButton = screen.getByText('Create Slash Command');
      expect(createButton).toBeInTheDocument();

      // Clicking should open creation dialog
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText(/Create Slash Command/)).toBeInTheDocument();
      });
    });
  });
});
