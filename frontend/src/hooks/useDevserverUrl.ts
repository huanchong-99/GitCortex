import { useEffect, useRef, useState } from 'react';
import { stripAnsi } from 'fancy-ansi';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::', '[::]']);
const URL_STOP_CHARS = new Set([' ', '\t', '\n', '\r', '"', '\'', '`', '<', '>']);
const TOKEN_BOUNDARY_CHARS = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
  '"',
  '\'',
  '`',
  '<',
  '>',
  ',',
  ';',
  '(',
  ')',
  '{',
  '}',
]);

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isIpv4Host = (host: string): boolean => {
  const parts = host.split('.');
  if (parts.length !== 4) {
    return false;
  }

  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return false;
    }
    for (const char of part) {
      if (!isDigit(char)) {
        return false;
      }
    }
  }

  return true;
};

const parseHostPortToken = (token: string): { host: string; port: number } | null => {
  if (!token || token.includes('://')) {
    return null;
  }

  let host = '';
  let portStart = -1;

  if (token.startsWith('[')) {
    const closeBracket = token.indexOf(']');
    if (closeBracket < 0 || closeBracket + 1 >= token.length || token[closeBracket + 1] !== ':') {
      return null;
    }
    host = token.slice(0, closeBracket + 1);
    portStart = closeBracket + 2;
  } else {
    const separator = token.lastIndexOf(':');
    if (separator <= 0) {
      return null;
    }
    host = token.slice(0, separator);
    portStart = separator + 1;
  }

  let portEnd = portStart;
  while (portEnd < token.length && isDigit(token[portEnd])) {
    portEnd++;
  }

  const portLength = portEnd - portStart;
  if (portLength < 2 || portLength > 5) {
    return null;
  }

  return {
    host,
    port: Number(token.slice(portStart, portEnd)),
  };
};

const extractFullUrlCandidate = (text: string, lowerText: string): string | null => {
  const httpIndex = lowerText.indexOf('http://');
  const httpsIndex = lowerText.indexOf('https://');

  let start = -1;
  if (httpIndex >= 0 && httpsIndex >= 0) {
    start = Math.min(httpIndex, httpsIndex);
  } else if (httpIndex >= 0) {
    start = httpIndex;
  } else if (httpsIndex >= 0) {
    start = httpsIndex;
  }

  if (start < 0) {
    return null;
  }

  let end = start;
  while (end < text.length && !URL_STOP_CHARS.has(text[end])) {
    end++;
  }

  return text.slice(start, end);
};

const extractHostPortCandidate = (text: string): { host: string; port: number } | null => {
  let index = 0;
  while (index < text.length) {
    while (index < text.length && TOKEN_BOUNDARY_CHARS.has(text[index])) {
      index++;
    }
    if (index >= text.length) {
      break;
    }

    const start = index;
    while (index < text.length && !TOKEN_BOUNDARY_CHARS.has(text[index])) {
      index++;
    }

    const token = text.slice(start, index);
    const parsed = parseHostPortToken(token);
    if (parsed) {
      return parsed;
    }
  }

  return null;
};

export type DevserverUrlInfo = {
  url: string;
  port?: number;
  scheme: 'http' | 'https';
};

// Get the hostname from the current browser location, falling back to 'localhost'
const getBrowserHostname = (): string => {
  if (globalThis.window !== undefined) {
    return globalThis.window.location.hostname;
  }
  return 'localhost';
};

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

export const detectDevserverUrl = (line: string): DevserverUrlInfo | null => {
  const cleaned = stripAnsi(line);
  const cleanedLower = cleaned.toLowerCase();
  const browserHostname = getBrowserHostname();

  const fullUrlCandidate = extractFullUrlCandidate(cleaned, cleanedLower);
  if (fullUrlCandidate) {
    try {
      const parsed = new URL(fullUrlCandidate);
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
      // Ignore invalid URLs and fall through to host:port detection.
    }
  }

  const hostPortCandidate = extractHostPortCandidate(cleaned);
  if (hostPortCandidate) {
    const { host, port } = hostPortCandidate;
    if (!isLocalHost(host)) {
      return null;
    }
    const scheme = cleanedLower.includes('https') ? 'https' : 'http';
    const normalizedHost = normalizeHost(host, browserHostname);
    return {
      url: `${scheme}://${normalizedHost}:${port}`,
      port,
      scheme,
    };
  }

  return null;
};

export const useDevserverUrlFromLogs = (
  logs: Array<{ content: string }> | undefined
): DevserverUrlInfo | undefined => {
  const [urlInfo, setUrlInfo] = useState<DevserverUrlInfo | undefined>();
  const lastIndexRef = useRef(0);

  useEffect(() => {
    if (!logs) {
      setUrlInfo(undefined);
      lastIndexRef.current = 0;
      return;
    }

    if (logs.length < lastIndexRef.current) {
      lastIndexRef.current = 0;
      setUrlInfo(undefined);
    }

    if (urlInfo) {
      lastIndexRef.current = logs.length;
      return;
    }

    let detectedUrl: DevserverUrlInfo | undefined;
    const newEntries = logs.slice(lastIndexRef.current);
    newEntries.some((entry) => {
      const detected = detectDevserverUrl(entry.content);
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
};
