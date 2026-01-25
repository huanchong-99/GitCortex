import { describe, it, expect } from 'vitest';

describe('tailwind default config', () => {
  it('exposes a non-empty content array', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require('../../tailwind.config.cjs');
    expect(Array.isArray(config.content)).toBe(true);
    expect(config.content.length).toBeGreaterThan(0);
  });
});
