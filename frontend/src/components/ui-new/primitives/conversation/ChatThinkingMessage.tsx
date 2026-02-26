import { ChatDotsIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from './ChatMarkdown';

interface ChatThinkingMessageProps {
  readonly content: string;
  readonly className?: string;
  readonly taskAttemptId?: string;
}

export function ChatThinkingMessage({
  content,
  className,
  taskAttemptId,
}: Readonly<ChatThinkingMessageProps>) {
  return (
    <div
      className={cn('flex items-start gap-base text-sm text-low', className)}
    >
      <ChatDotsIcon className="shrink-0 size-icon-base mt-0.5" />
      <ChatMarkdown content={content} workspaceId={taskAttemptId} />
    </div>
  );
}
