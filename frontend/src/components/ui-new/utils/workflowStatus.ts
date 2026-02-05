import i18next, { type TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  CheckCircle,
  Circle,
  Clock,
  Loader2,
  Pause,
  Play,
  XCircle,
  ShieldQuestion,
} from 'lucide-react';

export type StatusTone =
  | 'success'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'danger'
  | 'brand';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  icon: LucideIcon;
  spin?: boolean;
}

type StatusConfig = {
  key: string;
  tone: StatusTone;
  icon: LucideIcon;
  spin?: boolean;
};

const WORKFLOW_STATUS_CONFIG: Record<string, StatusConfig> = {
  created: {
    key: 'workflow:status.created',
    tone: 'neutral',
    icon: Circle,
  },
  ready: {
    key: 'workflow:status.ready',
    tone: 'info',
    icon: Play,
  },
  starting: {
    key: 'workflow:status.starting',
    tone: 'info',
    icon: Loader2,
    spin: true,
  },
  running: {
    key: 'workflow:status.running',
    tone: 'brand',
    icon: Play,
  },
  paused: {
    key: 'workflow:status.paused',
    tone: 'warning',
    icon: Pause,
  },
  completed: {
    key: 'workflow:status.completed',
    tone: 'success',
    icon: CheckCircle,
  },
  failed: {
    key: 'workflow:status.failed',
    tone: 'danger',
    icon: XCircle,
  },
  cancelled: {
    key: 'workflow:status.cancelled',
    tone: 'neutral',
    icon: XCircle,
  },
  idle: {
    key: 'workflow:status.idle',
    tone: 'neutral',
    icon: Circle,
  },
  queued: {
    key: 'workflow:status.queued',
    tone: 'info',
    icon: Clock,
  },
  unknown: {
    key: 'workflow:status.unknown',
    tone: 'neutral',
    icon: Circle,
  },
};

const TERMINAL_STATUS_CONFIG: Record<string, StatusConfig> = {
  not_started: {
    key: 'workflow:terminalDebug.status.not_started',
    tone: 'neutral',
    icon: Circle,
  },
  starting: {
    key: 'workflow:terminalDebug.status.starting',
    tone: 'info',
    icon: Loader2,
    spin: true,
  },
  waiting: {
    key: 'workflow:terminalDebug.status.waiting',
    tone: 'info',
    icon: Clock,
  },
  working: {
    key: 'workflow:terminalDebug.status.working',
    tone: 'brand',
    icon: Play,
  },
  running: {
    key: 'workflow:terminalDebug.status.running',
    tone: 'brand',
    icon: Play,
  },
  active: {
    key: 'workflow:terminalDebug.status.active',
    tone: 'brand',
    icon: Play,
  },
  paused: {
    key: 'workflow:terminalDebug.status.paused',
    tone: 'warning',
    icon: Pause,
  },
  completed: {
    key: 'workflow:terminalDebug.status.completed',
    tone: 'success',
    icon: CheckCircle,
  },
  failed: {
    key: 'workflow:terminalDebug.status.failed',
    tone: 'danger',
    icon: XCircle,
  },
  killed: {
    key: 'workflow:terminalDebug.status.killed',
    tone: 'danger',
    icon: AlertTriangle,
  },
  idle: {
    key: 'workflow:terminalDebug.status.idle',
    tone: 'neutral',
    icon: Circle,
  },
  waiting_for_approval: {
    key: 'workflow:terminalDebug.status.waiting_for_approval',
    tone: 'warning',
    icon: ShieldQuestion,
  },
  stalled: {
    key: 'workflow:terminalDebug.status.stalled',
    tone: 'warning',
    icon: AlertTriangle,
  },
  unknown: {
    key: 'workflow:terminalDebug.status.unknown',
    tone: 'neutral',
    icon: Circle,
  },
};

const defaultT = i18next.t.bind(i18next);

function normalizeStatus(status?: string | null) {
  return (status ?? 'unknown').toLowerCase();
}

function resolveStatusMeta(
  status: string | null | undefined,
  config: Record<string, StatusConfig>,
  t: TFunction
): StatusMeta {
  const normalized = normalizeStatus(status);
  const entry = config[normalized] ?? config.unknown;
  const label = t(entry.key, { defaultValue: status ?? 'Unknown' });

  return {
    label,
    tone: entry.tone,
    icon: entry.icon,
    spin: entry.spin,
  };
}

export function getWorkflowStatusMeta(
  status: string | null | undefined,
  t: TFunction = defaultT
): StatusMeta {
  return resolveStatusMeta(status, WORKFLOW_STATUS_CONFIG, t);
}

export function getTerminalStatusMeta(
  status: string | null | undefined,
  t: TFunction = defaultT
): StatusMeta {
  return resolveStatusMeta(status, TERMINAL_STATUS_CONFIG, t);
}
