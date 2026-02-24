import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStatus } from './useAuthStatus';

const { mockUseQuery, mockRefetch } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockRefetch: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  isSignedIn: false,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mockUseQuery,
}));

vi.mock('@/hooks', () => ({
  useAuth: () => ({ isSignedIn: authState.isSignedIn }),
}));

describe('useAuthStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isSignedIn = false;
    mockUseQuery.mockReturnValue({
      refetch: mockRefetch,
    });
  });

  it('does not refetch when disabled even if auth state changes', async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useAuthStatus({ enabled }),
      { initialProps: { enabled: false } }
    );

    await waitFor(() => {
      expect(mockUseQuery).toHaveBeenCalled();
    });
    expect(mockRefetch).not.toHaveBeenCalled();

    authState.isSignedIn = true;
    rerender({ enabled: false });

    await waitFor(() => {
      expect(mockUseQuery).toHaveBeenCalledTimes(2);
    });
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('keeps refetch behavior when enabled', async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useAuthStatus({ enabled }),
      { initialProps: { enabled: true } }
    );

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    authState.isSignedIn = true;
    rerender({ enabled: true });

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(2);
    });
  });
});
