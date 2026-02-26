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
}: ChatErrorMessageProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-base text-sm text-error cursor-pointer',
        className
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(); } }}
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
    </div>
  );
}
