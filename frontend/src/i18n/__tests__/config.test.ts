import { describe, it, expect, vi } from 'vitest';

describe('i18n config', () => {
  it('does not log debug output in tests', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await import('../config');
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
