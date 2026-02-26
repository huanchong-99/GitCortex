import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  TerminalPromptDecisionPayload,
  TerminalPromptDetectedPayload,
} from '@/stores/wsStore';
import { cn } from '@/lib/utils';

interface WorkflowPromptDialogProps {
  prompt: TerminalPromptDetectedPayload;
  decision: TerminalPromptDecisionPayload | null;
  isSubmitting: boolean;
  submitError: string | null;
  onSubmit: (response: string) => void;
}

export const ENTER_CONFIRM_RESPONSE_TOKEN =
  '__WORKFLOW_PROMPT_ENTER_CONFIRM__';

const ANSI_ARROW_UP = '\u001b[A';
const ANSI_ARROW_DOWN = '\u001b[B';

type PromptDialogMode =
  | 'yes_no'
  | 'choice'
  | 'arrow_select'
  | 'input'
  | 'password'
  | 'enter_confirm'
  | 'unknown';

function normalizeChoiceOptions(prompt: TerminalPromptDetectedPayload): string[] {
  if (prompt.options.length > 0) {
    return prompt.options;
  }

  if (prompt.optionDetails?.length) {
    return prompt.optionDetails
      .map((option) => option.label)
      .filter((label) => label.trim().length > 0);
  }

  return [];
}

function getPromptDialogMode(prompt: TerminalPromptDetectedPayload): PromptDialogMode {
  switch (prompt.promptKind) {
    case 'yes_no':
      return 'yes_no';
    case 'choice':
      return 'choice';
    case 'arrow_select':
      return 'arrow_select';
    case 'input':
      return 'input';
    case 'password':
      return 'password';
    case 'enter_confirm':
      return 'enter_confirm';
    default:
      return 'unknown';
  }
}

function getDefaultChoiceIndex(prompt: TerminalPromptDetectedPayload): number {
  if (typeof prompt.selectedIndex === 'number' && prompt.selectedIndex >= 0) {
    return prompt.selectedIndex;
  }
  if (prompt.optionDetails?.length) {
    const selectedOption = prompt.optionDetails.find((option) => option.selected);
    if (selectedOption && selectedOption.index >= 0) {
      return selectedOption.index;
    }
  }
  return 0;
}

function buildArrowSelectResponse(
  currentIndex: number,
  targetIndex: number
): string {
  if (targetIndex === currentIndex) {
    return '';
  }

  const stepToken = targetIndex > currentIndex ? ANSI_ARROW_DOWN : ANSI_ARROW_UP;
  return stepToken.repeat(Math.abs(targetIndex - currentIndex));
}

export function WorkflowPromptDialog({
  prompt,
  decision,
  isSubmitting,
  submitError,
  onSubmit,
}: Readonly<WorkflowPromptDialogProps>) {
  const mode = getPromptDialogMode(prompt);

  const choiceOptions = useMemo(() => normalizeChoiceOptions(prompt), [prompt]);

  const defaultChoiceIndex = useMemo(
    () =>
      Math.min(
        Math.max(getDefaultChoiceIndex(prompt), 0),
        Math.max(choiceOptions.length - 1, 0)
      ),
    [prompt, choiceOptions]
  );

  const [choiceIndex, setChoiceIndex] = useState(defaultChoiceIndex);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    setInputValue('');
    setChoiceIndex(defaultChoiceIndex);
  }, [defaultChoiceIndex, prompt]);

  const decisionReason = decision?.decisionDetail?.reason;
  const decisionSuggestions = decision?.decisionDetail?.suggestions;

  const handleSubmit = (response: string) => {
    if (isSubmitting) {
      return;
    }
    onSubmit(response);
  };

  const renderInputSubmit = (placeholder: string, inputType: 'text' | 'password') => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(inputValue);
      }}
      className="space-y-3"
    >
      <Input
        type={inputType}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder={placeholder}
        disabled={isSubmitting}
        autoFocus
        data-testid="workflow-prompt-input"
      />
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting || inputValue.trim().length === 0}
          data-testid="workflow-prompt-submit-input"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </Button>
      </div>
    </form>
  );

  const renderChoiceButtons = (responseBuilder: (index: number) => string) => {
    if (choiceOptions.length === 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-low" data-testid="workflow-prompt-empty-options">
            No options were detected. Enter a response manually.
          </p>
          {renderInputSubmit('Enter response', 'text')}
        </div>
      );
    }

    return (
      <div className="space-y-2" role="radiogroup" aria-label="Prompt options">
        {choiceOptions.map((option, index) => {
          const selected = index === choiceIndex;
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              role="radio"
              aria-checked={selected}
              className={cn(
                'w-full rounded border px-3 py-2 text-left text-sm transition-colors',
                selected
                  ? 'border-brand bg-brand/10 text-primary'
                  : 'border-border text-low hover:border-brand/60 hover:text-primary'
              )}
              disabled={isSubmitting}
              onClick={() => setChoiceIndex(index)}
              data-testid={`workflow-prompt-option-${index}`}
            >
              {option}
            </button>
          );
        })}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => handleSubmit(responseBuilder(choiceIndex))}
            disabled={isSubmitting}
            data-testid="workflow-prompt-submit-option"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    switch (mode) {
      case 'yes_no':
        return (
          <div className="flex gap-2" data-testid="workflow-prompt-yes-no">
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit('y')}
            >
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleSubmit('n')}
            >
              No
            </Button>
          </div>
        );
      case 'choice':
        return renderChoiceButtons((index) => choiceOptions[index] ?? '');
      case 'arrow_select':
        return renderChoiceButtons((index) =>
          buildArrowSelectResponse(defaultChoiceIndex, index)
        );
      case 'input':
        return renderInputSubmit('Enter value', 'text');
      case 'password':
        return renderInputSubmit('Enter password', 'password');
      case 'enter_confirm':
        return (
          <Button
            type="button"
            onClick={() => handleSubmit(ENTER_CONFIRM_RESPONSE_TOKEN)}
            disabled={isSubmitting}
            data-testid="workflow-prompt-enter-confirm"
          >
            {isSubmitting ? 'Submitting...' : 'Press Enter'}
          </Button>
        );
      default:
        return renderInputSubmit('Enter response', 'text');
    }
  };

  const detailRows = [
    { label: 'Terminal', value: prompt.terminalId },
    { label: 'Task', value: prompt.taskId ?? 'N/A' },
    { label: 'Prompt Type', value: prompt.promptKind },
  ];

  return (
    <Dialog open onOpenChange={() => {}} uncloseable>
      <DialogContent className="sm:max-w-[560px]" data-testid="workflow-prompt-dialog">
        <DialogHeader>
          <DialogTitle>Action Required</DialogTitle>
          <DialogDescription>
            A workflow terminal is waiting for your response.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded border border-border bg-secondary/30 p-3 text-sm">
            <p className="whitespace-pre-wrap text-primary">{prompt.promptText}</p>
          </div>

          <div className="grid gap-2 text-xs text-low sm:grid-cols-3">
            {detailRows.map((row) => (
              <div key={row.label}>
                <p className="font-medium text-primary">{row.label}</p>
                <p className="truncate" title={row.value}>
                  {row.value}
                </p>
              </div>
            ))}
          </div>

          {decisionReason && (
            <p className="text-xs text-low" data-testid="workflow-prompt-decision-reason">
              Reason: {decisionReason}
            </p>
          )}

          {Array.isArray(decisionSuggestions) && decisionSuggestions.length > 0 && (
            <p
              className="text-xs text-low"
              data-testid="workflow-prompt-decision-suggestions"
            >
              Suggestions: {decisionSuggestions.join(', ')}
            </p>
          )}

          {renderBody()}

          {submitError && (
            <p className="text-sm text-error" data-testid="workflow-prompt-error">
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter>
          <p className="text-xs text-low">Workflow is paused until you respond.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
