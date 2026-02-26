import { cn } from '@/lib/utils';
import { splitLines } from '@/utils/string';

interface ErrorAlertProps {
  readonly message: string;
  readonly className?: string;
}

export function ErrorAlert({ message, className }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative w-full border border-error bg-error/10 p-base text-sm text-error',
        className
      )}
    >
      {splitLines(message).map((line, i, lines) => (
        <span key={`error-line-${line.slice(0, 20)}-${i}`}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}
