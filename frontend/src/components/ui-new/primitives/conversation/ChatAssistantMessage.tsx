import { ChatMarkdown } from './ChatMarkdown';

interface ChatAssistantMessageProps {
  readonly content: string;
  readonly workspaceId?: string;
}

export function ChatAssistantMessage({
  content,
  workspaceId,
}: ChatAssistantMessageProps) {
  return <ChatMarkdown content={content} workspaceId={workspaceId} />;
}
