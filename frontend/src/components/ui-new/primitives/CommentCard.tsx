import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CommentCardVariant = 'user' | 'github' | 'input';

interface CommentCardProps {
  /** Determines the visual styling */
  readonly variant: CommentCardVariant;
  /** Main content (editor, text, etc.) */
  readonly children: ReactNode;
  /** Optional header (author, timestamp) */
  readonly header?: ReactNode;
  /** Optional action buttons */
  readonly actions?: ReactNode;
  /** Additional className for the outer wrapper */
  readonly className?: string;
}

const variantStyles: Record<CommentCardVariant, string> = {
  user: 'bg-brand/20 border-brand',
  github: 'bg-secondary border-border',
  input: 'bg-brand/20 border-brand',
};

/**
 * Shared primitive for displaying comments in diff views.
 * Used by ReviewCommentRenderer, GitHubCommentRenderer, and CommentWidgetLine.
 */
export function CommentCard({
  variant,
  children,
  header,
  actions,
  className,
}: Readonly<CommentCardProps>) {
  return (
    <div className="p-base bg-panel font-sans text-base">
      <div
        className={cn(
          'p-base rounded-sm border',
          variantStyles[variant],
          className
        )}
      >
        {header && <div className="mb-half">{header}</div>}
        {children}
        {actions && <div className="mt-half flex gap-half">{actions}</div>}
      </div>
    </div>
  );
}
