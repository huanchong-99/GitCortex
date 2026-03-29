import type { TerminalStatus } from '@/components/workflow/TerminalCard';

const TERMINAL_STATUS_SET = new Set<TerminalStatus>([
  'not_started', 'starting', 'waiting', 'working',
  'completed', 'failed', 'cancelled', 'review_passed', 'review_rejected',
]);

/**
 * Maps backend terminal status string to frontend TerminalStatus type.
 * Handles known aliases (running → working, idle → not_started) and
 * falls back to 'not_started' for unrecognized values.
 */
export function mapTerminalStatus(status: string): TerminalStatus {
  if (TERMINAL_STATUS_SET.has(status as TerminalStatus)) {
    return status as TerminalStatus;
  }
  if (status === 'running') return 'working';
  if (status === 'idle') return 'not_started';
  return 'not_started';
}
