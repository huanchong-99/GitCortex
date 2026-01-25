import { describe, it, expect, vi } from 'vitest';
import { logApiError } from '../api';

describe('api logging', () => {
  it('does not emit console.error in tests', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logApiError('Test error', { status: 500 });
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
