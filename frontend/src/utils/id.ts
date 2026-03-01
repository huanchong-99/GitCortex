let seq = 0;
let fallbackCounter = 0;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function secureRandomIdFragment(length = 8): string {
  const normalizedLength = Math.max(1, Math.trunc(length));
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === 'function') {
    let randomValue = '';
    while (randomValue.length < normalizedLength) {
      randomValue += cryptoApi.randomUUID().replace(/-/g, '');
    }
    return randomValue.slice(0, normalizedLength);
  }

  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(Math.ceil(normalizedLength / 2));
    cryptoApi.getRandomValues(bytes);
    return bytesToHex(bytes).slice(0, normalizedLength);
  }

  // Fallback for legacy runtimes without Web Crypto: monotonic and process-local unique.
  fallbackCounter = (fallbackCounter + 1) >>> 0;
  const fallbackValue = `${Date.now().toString(36)}${fallbackCounter.toString(36)}`;
  return fallbackValue.length >= normalizedLength
    ? fallbackValue.slice(-normalizedLength)
    : fallbackValue.padStart(normalizedLength, '0');
}

export function genId(): string {
  seq = (seq + 1) & 0xffff;
  return `${Date.now().toString(36)}-${seq.toString(36)}-${secureRandomIdFragment(6)}`;
}
