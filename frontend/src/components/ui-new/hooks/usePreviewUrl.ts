import {
  detectDevserverUrl,
  useDevserverUrlFromLogs,
  type DevserverUrlInfo,
} from '@/hooks/useDevserverUrl';

export type PreviewUrlInfo = DevserverUrlInfo;

export const detectPreviewUrl = (line: string): PreviewUrlInfo | null =>
  detectDevserverUrl(line);

export function usePreviewUrl(
  logs: Array<{ content: string }> | undefined
): PreviewUrlInfo | undefined {
  return useDevserverUrlFromLogs(logs);
}
