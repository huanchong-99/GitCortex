import { useEffect, useRef, useState } from 'react';
import { stripAnsi } from 'fancy-ansi';

export interface PreviewUrlInfo {
  url: string;
  port?: number;
  scheme: 'http' | 'https';
}

const FULL_URL_PATTERN = /(https?:\/\/[^\s"'`<>]+)/i;
const HOST_PORT_PATTERN = /([a-z0-9.:-]+):(\d{2,5})/i;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::', '[::]']);
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

// Get the hostname from the current browser location, falling back to 'localhost'
const getBrowserHostname = (): string => {
  if (globalThis.window !== undefined) {
    return globalThis.window.location.hostname;
  }
  return 'localhost';
};

const isIpv4Host = (host: string): boolean => IPV4_PATTERN.test(host);

const isBracketedIpv6Host = (host: string): boolean =>
  host.startsWith('[') && host.endsWith(']');

const isLocalHost = (host: string): boolean => {
  const lowered = host.toLowerCase();
  return (
    LOCAL_HOSTS.has(lowered) ||
    isIpv4Host(lowered) ||
    isBracketedIpv6Host(lowered)
  );
};

const normalizeHost = (host: string, browserHostname: string): string => {
  const lowered = host.toLowerCase();
  if (lowered === '0.0.0.0' || lowered === '::' || lowered === '[::]') {
    return browserHostname;
  }
  return host;
};

export const detectPreviewUrl = (line: string): PreviewUrlInfo | null => {
  const cleaned = stripAnsi(line);
  const browserHostname = getBrowserHostname();

  // Try to match a full URL first
  const fullUrlMatch = FULL_URL_PATTERN.exec(cleaned);
  if (fullUrlMatch) {
    try {
      const parsed = new URL(fullUrlMatch[1]);
      if (!isLocalHost(parsed.hostname)) {
        return null;
      }
      parsed.hostname = normalizeHost(parsed.hostname, browserHostname);
      return {
        url: parsed.toString(),
        port: parsed.port ? Number(parsed.port) : undefined,
        scheme: parsed.protocol === 'https:' ? 'https' : 'http',
      };
    } catch {
      // Ignore invalid URLs and fall through to host:port detection
    }
  }

  // Try to match host:port pattern
  const hostPortMatch = HOST_PORT_PATTERN.exec(cleaned);
  if (hostPortMatch) {
    const host = hostPortMatch[1];
    if (!isLocalHost(host)) {
      return null;
    }
    const port = Number(hostPortMatch[2]);
    const scheme = /https/i.test(cleaned) ? 'https' : 'http';
    const normalizedHost = normalizeHost(host, browserHostname);
    return {
      url: `${scheme}://${normalizedHost}:${port}`,
      port,
      scheme,
    };
  }

  return null;
};

export function usePreviewUrl(
  logs: Array<{ content: string }> | undefined
): PreviewUrlInfo | undefined {
  const [urlInfo, setUrlInfo] = useState<PreviewUrlInfo | undefined>();
  const lastIndexRef = useRef(0);

  useEffect(() => {
    if (!logs) {
      setUrlInfo(undefined);
      lastIndexRef.current = 0;
      return;
    }

    // Reset if logs were cleared (new process started)
    if (logs.length < lastIndexRef.current) {
      lastIndexRef.current = 0;
      setUrlInfo(undefined);
    }

    // If we already have a URL, just update the index and skip
    if (urlInfo) {
      lastIndexRef.current = logs.length;
      return;
    }

    // Scan new log entries for URL
    let detectedUrl: PreviewUrlInfo | undefined;
    const newEntries = logs.slice(lastIndexRef.current);
    newEntries.some((entry) => {
      const detected = detectPreviewUrl(entry.content);
      if (detected) {
        detectedUrl = detected;
        return true;
      }
      return false;
    });

    if (detectedUrl) {
      setUrlInfo((prev) => prev ?? detectedUrl);
    }

    lastIndexRef.current = logs.length;
  }, [logs, urlInfo]);

  return urlInfo;
}
