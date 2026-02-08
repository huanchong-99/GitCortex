const REMOTE_RESOURCE_PATTERN = /remote\s+(project|organization)/i;
const UNSUPPORTED_PATTERN = /(not\s+supported|unavailable|disabled)/i;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }
  }

  return '';
}

export function isRemoteProjectCapabilityUnsupported(error: unknown): boolean {
  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }

  return (
    REMOTE_RESOURCE_PATTERN.test(message) && UNSUPPORTED_PATTERN.test(message)
  );
}
