import { forwardRef } from 'react';
import {
  ListMagnifyingGlassIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { ToolStatus } from 'shared/types';
import { ToolStatusDot } from './ToolStatusDot';

interface ChatToolSummaryProps {
  readonly summary: string;
  readonly className?: string;
  readonly expanded?: boolean;
  readonly onToggle?: () => void;
  readonly status?: ToolStatus;
  readonly onViewContent?: () => void;
  readonly toolName?: string;
  readonly isTruncated?: boolean;
}

export const ChatToolSummary = forwardRef<
  HTMLSpanElement,
  ChatToolSummaryProps
>(function ChatToolSummary(
  {
    summary,
    className,
    expanded,
    onToggle,
    status,
    onViewContent,
    toolName,
    isTruncated,
  },
  ref
) {
  // Can expand if text is truncated and onToggle is provided
  const canExpand = isTruncated && onToggle;
  const isClickable = Boolean(onViewContent || canExpand);

  const handleClick = () => {
    if (onViewContent) {
      onViewContent();
    } else if (canExpand) {
      onToggle();
    }
  };

  const Icon =
    toolName === 'Bash' ? TerminalWindowIcon : ListMagnifyingGlassIcon;

  const Wrapper = isClickable ? 'button' : 'div';

  return (
    <Wrapper
      {...(isClickable ? { type: 'button' as const, onClick: handleClick } : {})}
      className={cn(
        'flex items-start gap-base text-sm text-low text-left',
        isClickable && 'cursor-pointer',
        className
      )}
    >
      <span className="relative shrink-0 mt-0.5">
        <Icon className="size-icon-base" />
        {status && (
          <ToolStatusDot
            status={status}
            className="absolute -bottom-0.5 -left-0.5"
          />
        )}
      </span>
      <span
        ref={ref}
        className={cn(
          !expanded && 'truncate',
          expanded && 'whitespace-pre-wrap break-all'
        )}
      >
        {summary}
      </span>
    </Wrapper>
  );
});
