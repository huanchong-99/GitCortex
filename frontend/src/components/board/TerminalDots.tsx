import { cn } from '@/lib/utils';

type TerminalStatus = 'not_started' | 'starting' | 'waiting' | 'working' | 'completed' | 'failed' | 'cancelled' | 'review_passed' | 'review_rejected' | 'quality_pending';

interface TerminalInfo {
  id: string;
  status: TerminalStatus;
}

interface TerminalDotsProps {
  /** Simple count for backwards compatibility */
  readonly terminalCount?: number;
  /** Terminal info with status for differentiated display */
  readonly terminals?: TerminalInfo[];
}

/**
 * Get status-based color class for terminal dot
 */
function getStatusColor(status: TerminalStatus): string {
  switch (status) {
    case 'working':
      return 'bg-green-500 animate-pulse';
    case 'waiting':
      return 'bg-blue-500';
    case 'starting':
      return 'bg-yellow-500';
    case 'completed':
    case 'review_passed':
      return 'bg-green-500';
    case 'failed':
    case 'cancelled':
    case 'review_rejected':
      return 'bg-red-500';
    case 'quality_pending':
      return 'bg-yellow-500 animate-pulse';
    case 'not_started':
    default:
      return 'bg-gray-400';
  }
}

export function TerminalDots({ terminalCount, terminals }: Readonly<TerminalDotsProps>) {
  // If terminals array is provided, use status-based coloring
  if (terminals && terminals.length > 0) {
    return (
      <div className="flex gap-1" aria-label="terminal-status">
        {terminals.map((terminal) => (
          <span
            key={terminal.id}
            data-testid="terminal-dot"
            title={terminal.status}
            className={cn('h-2 w-2 rounded-full', getStatusColor(terminal.status))}
          />
        ))}
      </div>
    );
  }

  // Fallback to simple count display (backwards compatibility)
  const count = terminalCount ?? 0;
  return (
    <div className="flex gap-1" aria-label="terminal-count">
      {Array.from({ length: count }, (_, index) => index).map((index) => (
        <span
          key={`terminal-dot-${index}`}
          data-testid="terminal-dot"
          className="h-2 w-2 rounded-full bg-brand"
        />
      ))}
    </div>
  );
}
