import { WarningCircleIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface ChatErrorMessageProps {
  readonly content: string;
  readonly className?: string;
  readonly expanded?: boolean;
  readonly onToggle?: () => void;
}

export function ChatErrorMessage({
  content,
  className,
  expanded,
  onToggle,
}: Readonly<ChatErrorMessageProps>) {
  return (
    <button
      type="button"
      className={cn(
        'flex items-start gap-base text-sm text-error cursor-pointer text-left w-full',
        className
      )}
      onClick={onToggle}
    >
      <WarningCircleIcon className="shrink-0 size-icon-base mt-0.5" />
      <span
        className={cn(
          !expanded && 'truncate',
          expanded && 'whitespace-pre-wrap break-all'
        )}
      >
        {content}
      </span>
    </button>
  );
}
