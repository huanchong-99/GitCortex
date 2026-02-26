import { InfoIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface ChatSystemMessageProps {
  readonly content: string;
  readonly className?: string;
  readonly expanded?: boolean;
  readonly onToggle?: () => void;
}

export function ChatSystemMessage({
  content,
  className,
  expanded,
  onToggle,
}: Readonly<ChatSystemMessageProps>) {
  return (
    <div
      className={cn(
        'flex items-start gap-base text-sm text-low cursor-pointer',
        className
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle?.(); } }}
    >
      <InfoIcon className="shrink-0 size-icon-base mt-0.5" />
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
