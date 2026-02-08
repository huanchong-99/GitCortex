import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ENTER_CONFIRM_RESPONSE_TOKEN,
  WorkflowPromptDialog,
} from './WorkflowPromptDialog';
import type { TerminalPromptDetectedPayload } from '@/stores/wsStore';

const basePrompt: TerminalPromptDetectedPayload = {
  workflowId: 'wf-1',
  terminalId: 'term-1',
  taskId: 'task-1',
  sessionId: 'session-1',
  promptKind: 'yes_no',
  promptText: 'Continue?',
  confidence: 0.99,
  hasDangerousKeywords: false,
  options: ['yes', 'no'],
  selectedIndex: 0,
};

describe('WorkflowPromptDialog', () => {
  it('submits yes/no response', () => {
    const onSubmit = vi.fn();
    render(
      <WorkflowPromptDialog
        prompt={basePrompt}
        decision={null}
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onSubmit).toHaveBeenCalledWith('y');
  });

  it('submits choice/arrow_select by 1-based index', () => {
    const onSubmit = vi.fn();
    render(
      <WorkflowPromptDialog
        prompt={{
          ...basePrompt,
          promptKind: 'arrow_select',
          promptText: 'Select framework',
          options: ['React', 'Vue', 'Svelte'],
          selectedIndex: 0,
        }}
        decision={null}
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-prompt-option-2'));
    fireEvent.click(screen.getByTestId('workflow-prompt-submit-option'));

    expect(onSubmit).toHaveBeenCalledWith('\u001b[B\u001b[B');
  });

  it('submits choice prompt with selected option label', () => {
    const onSubmit = vi.fn();
    render(
      <WorkflowPromptDialog
        prompt={{
          ...basePrompt,
          promptKind: 'choice',
          promptText: 'Select target',
          options: ['Staging', 'Production'],
          selectedIndex: 0,
        }}
        decision={null}
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByTestId('workflow-prompt-option-1'));
    fireEvent.click(screen.getByTestId('workflow-prompt-submit-option'));

    expect(onSubmit).toHaveBeenCalledWith('Production');
  });

  it('submits input and password values', () => {
    const onSubmit = vi.fn();
    const { rerender } = render(
      <WorkflowPromptDialog
        prompt={{
          ...basePrompt,
          promptKind: 'input',
          promptText: 'Enter username',
          options: [],
          selectedIndex: null,
        }}
        decision={null}
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByTestId('workflow-prompt-input'), {
      target: { value: 'alice' },
    });
    fireEvent.click(screen.getByTestId('workflow-prompt-submit-input'));
    expect(onSubmit).toHaveBeenCalledWith('alice');

    rerender(
      <WorkflowPromptDialog
        prompt={{
          ...basePrompt,
          promptKind: 'password',
          promptText: 'Password:',
          options: [],
          selectedIndex: null,
        }}
        decision={null}
        isSubmitting={false}
        submitError={null}
        onSubmit={onSubmit}
      />
    );

    const passwordInput = screen.getByTestId(
      'workflow-prompt-input'
    ) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.change(passwordInput, {
      target: { value: 's3cr3t' },
    });
    fireEvent.click(screen.getByTestId('workflow-prompt-submit-input'));
    expect(onSubmit).toHaveBeenLastCalledWith('s3cr3t');
  });

  it('submits enter_confirm token and shows decision metadata', () => {
    const onSubmit = vi.fn();
    render(
      <WorkflowPromptDialog
        prompt={{
          ...basePrompt,
          promptKind: 'enter_confirm',
          promptText: 'Press Enter to continue',
          options: [],
          selectedIndex: null,
        }}
        decision={{
          workflowId: 'wf-1',
          terminalId: 'term-1',
          decision: 'ask_user',
          decisionDetail: {
            reason: 'dangerous keyword detected',
            suggestions: ['confirm', 'cancel'],
          },
        }}
        isSubmitting={false}
        submitError="Failed"
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByTestId('workflow-prompt-decision-reason')).toHaveTextContent(
      'dangerous keyword detected'
    );
    expect(
      screen.getByTestId('workflow-prompt-decision-suggestions')
    ).toHaveTextContent('confirm, cancel');
    expect(screen.getByTestId('workflow-prompt-error')).toHaveTextContent('Failed');

    fireEvent.click(screen.getByTestId('workflow-prompt-enter-confirm'));
    expect(onSubmit).toHaveBeenCalledWith(ENTER_CONFIRM_RESPONSE_TOKEN);
  });
});
