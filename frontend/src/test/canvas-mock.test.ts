import { describe, it, expect } from 'vitest';

describe('canvas mock', () => {
  it('returns a 2d context for canvas', () => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    expect(context).toBeTruthy();
    expect(typeof context?.fillRect).toBe('function');
  });
});
