import { memo } from 'react';
import { AnsiHtml } from 'fancy-ansi/react';
import { hasAnsi } from 'fancy-ansi';
import { clsx } from 'clsx';

interface RawLogTextProps {
  readonly content: string;
  readonly channel?: 'stdout' | 'stderr';
  readonly as?: 'div' | 'span';
  readonly className?: string;
  readonly linkifyUrls?: boolean;
  readonly searchQuery?: string;
  readonly isCurrentMatch?: boolean;
}

const RawLogText = memo(
  ({
    content,
    channel = 'stdout',
    as: Component = 'div',
    className,
    linkifyUrls = false,
    searchQuery,
    isCurrentMatch = false,
  }: Readonly<RawLogTextProps>) => {
    // Only apply stderr fallback color when no ANSI codes are present
    const hasAnsiCodes = hasAnsi(content);
    const shouldApplyStderrFallback = channel === 'stderr' && !hasAnsiCodes;

    const highlightClass = isCurrentMatch
      ? 'bg-yellow-500/60 ring-1 ring-yellow-500 rounded-sm'
      : 'bg-yellow-500/30 rounded-sm';

    const highlightMatches = (text: string, key: string | number) => {
      if (!searchQuery) {
        return <AnsiHtml key={key} text={text} />;
      }

      const regex = new RegExp(
        `(${searchQuery.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'gi'
      );
      const parts = text.split(regex);

      return parts.map((part, idx) => {
        if (part.toLowerCase() === searchQuery.toLowerCase()) {
          return (
            <mark key={`${key}-${idx}`} className={highlightClass}>
              <AnsiHtml text={part} />
            </mark>
          );
        }
        return <AnsiHtml key={`${key}-${idx}`} text={part} />;
      });
    };

    const renderContent = () => {
      if (!linkifyUrls) {
        return highlightMatches(content, 'content');
      }

      const urlRegex = /(https?:\/\/\S+)/g;
      const parts = content.split(urlRegex);

      return parts.map((part, index) => {
        if (/^https?:\/\/\S+$/.test(part)) {
          return (
            <a
              key={`url-${part}`}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-info hover:text-info/80 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        // For non-URL parts, apply ANSI formatting with highlighting
        return highlightMatches(part, `part-${index}`);
      });
    };

    return (
      <Component
        className={clsx(
          'font-mono text-xs break-all whitespace-pre-wrap',
          shouldApplyStderrFallback && 'text-error',
          className
        )}
      >
        {renderContent()}
      </Component>
    );
  }
);

RawLogText.displayName = 'RawLogText';

export default RawLogText;
