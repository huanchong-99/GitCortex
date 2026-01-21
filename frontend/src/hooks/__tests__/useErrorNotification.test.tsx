import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useErrorNotification } from '../useErrorNotification';

describe('useErrorNotification', () => {
  it('calls onError with Error for string input', () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useErrorNotification({ onError, context: 'Test' })
    );

    act(() => {
      result.current.notifyError('boom');
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toContain('boom');
  });

  it('passes through Error instances', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useErrorNotification({ onError }));
    const err = new Error('fail');

    act(() => {
      result.current.notifyError(err);
    });

    expect(onError).toHaveBeenCalledWith(err);
  });

  it('wraps unknown types with context message', () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useErrorNotification({ onError, context: 'AgentAvailability' })
    );

    act(() => {
      result.current.notifyError({});
    });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'AgentAvailability: Unknown error',
      })
    );
  });
});
