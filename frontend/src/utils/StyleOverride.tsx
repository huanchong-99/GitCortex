import { useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { ThemeMode } from 'shared/types';

const ALLOWED_PARENT_ORIGIN = (import.meta.env.VITE_PARENT_ORIGIN ?? '').trim();
const SAFE_CSS_VALUE_PATTERN = /^[a-zA-Z0-9\s#(),.%/+_-]*$/;

const VIBE_CSS_VARIABLE_MAP: Record<string, string> = {
  '--vibe-background': '--background',
  '--vibe-foreground': '--foreground',
  '--vibe-primary': '--primary',
  '--vibe-primary-foreground': '--primary-foreground',
  '--vibe-secondary': '--secondary',
  '--vibe-secondary-foreground': '--secondary-foreground',
  '--vibe-muted': '--muted',
  '--vibe-muted-foreground': '--muted-foreground',
  '--vibe-accent': '--accent',
  '--vibe-accent-foreground': '--accent-foreground',
  '--vibe-border': '--border',
  '--vibe-input': '--input',
  '--vibe-ring': '--ring',
  '--vibe-brand': '--brand',
  '--vibe-brand-hover': '--brand-hover',
  '--vibe-brand-secondary': '--brand-secondary',
  '--vibe-text-high': '--text-high',
  '--vibe-text-normal': '--text-normal',
  '--vibe-text-low': '--text-low',
  '--vibe-bg-primary': '--bg-primary',
  '--vibe-bg-secondary': '--bg-secondary',
  '--vibe-bg-panel': '--bg-panel',
  '--vibe-success': '--success',
  '--vibe-warning': '--warning',
  '--vibe-error': '--error',
  '--vibe-info': '--info',
  '--vibe-neutral': '--neutral',
};

interface VibeStyleOverrideMessage {
  type: 'VIBE_STYLE_OVERRIDE';
  payload:
    | {
        kind: 'cssVars';
        variables: Record<string, string>;
      }
    | {
        kind: 'theme';
        theme: ThemeMode;
      };
}

interface VibeIframeReadyMessage {
  type: 'VIBE_IFRAME_READY';
}

function isThemeMode(value: unknown): value is ThemeMode {
  return (
    value === ThemeMode.LIGHT ||
    value === ThemeMode.DARK ||
    value === ThemeMode.SYSTEM
  );
}

function isSafeCssValue(value: string): boolean {
  const normalized = value.trim();
  if (!normalized || normalized.length > 120) {
    return false;
  }

  if (/[;{}<>`\\]/.test(normalized)) {
    return false;
  }

  if (/\burl\s*\(/i.test(normalized) || /\bexpression\s*\(/i.test(normalized)) {
    return false;
  }

  return SAFE_CSS_VALUE_PATTERN.test(normalized);
}

// Component that adds postMessage listener for style overrides
export function AppWithStyleOverride({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setTheme } = useTheme();

  useEffect(() => {
    let warnedMissingOrigin = false;

    function handleStyleMessage(event: MessageEvent) {
      if (
        !event.data ||
        typeof event.data !== 'object' ||
        (event.data as { type?: unknown }).type !== 'VIBE_STYLE_OVERRIDE'
      ) {
        return;
      }

      // Fail-closed: do not accept style overrides without explicit origin allowlist.
      if (!ALLOWED_PARENT_ORIGIN) {
        if (!warnedMissingOrigin) {
          warnedMissingOrigin = true;
          console.warn(
            '[StyleOverride] VITE_PARENT_ORIGIN is not configured; style override messages are rejected.'
          );
        }
        return;
      }

      if (
        event.origin !== ALLOWED_PARENT_ORIGIN ||
        event.source !== window.parent
      ) {
        console.warn(
          '[StyleOverride] Message from unauthorized origin:',
          event.origin
        );
        return;
      }

      const message = event.data as VibeStyleOverrideMessage;

      // CSS variable overrides (allowlisted --vibe-* variables only)
      if (
        message.payload.kind === 'cssVars' &&
        message.payload.variables &&
        typeof message.payload.variables === 'object' &&
        !Array.isArray(message.payload.variables)
      ) {
        Object.entries(message.payload.variables).forEach(([name, value]) => {
          const targetVariable = VIBE_CSS_VARIABLE_MAP[name];
          if (!targetVariable || typeof value !== 'string') return;
          if (!isSafeCssValue(value)) return;

          const normalizedValue = value.trim();
          document.documentElement.style.setProperty(name, normalizedValue);
          document.documentElement.style.setProperty(
            targetVariable,
            normalizedValue
          );
        });
      } else if (
        message.payload.kind === 'theme' &&
        isThemeMode(message.payload.theme)
      ) {
        setTheme(message.payload.theme);
      }
    }

    window.addEventListener('message', handleStyleMessage);
    return () => window.removeEventListener('message', handleStyleMessage);
  }, [setTheme]);

  // Send ready message to parent when component mounts
  useEffect(() => {
    // Fail-closed for outgoing handshake as well.
    if (!ALLOWED_PARENT_ORIGIN) {
      console.warn(
        '[StyleOverride] Skip VIBE_IFRAME_READY because VITE_PARENT_ORIGIN is not configured.'
      );
      return;
    }

    if (window.parent && window.parent !== window) {
      const readyMessage: VibeIframeReadyMessage = {
        type: 'VIBE_IFRAME_READY',
      };

      window.parent.postMessage(readyMessage, ALLOWED_PARENT_ORIGIN);
    }
  }, []);

  return <>{children}</>;
}
