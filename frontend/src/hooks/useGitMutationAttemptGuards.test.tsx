import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMerge } from './useMerge';
import { usePush } from './usePush';
import { useRebase } from './useRebase';

const { mockMerge, mockPush, mockRebase } = vi.hoisted(() => ({
  mockMerge: vi.fn(),
  mockPush: vi.fn(),
  mockRebase: vi.fn(),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    attemptsApi: {
      ...actual.attemptsApi,
      merge: mockMerge,
      push: mockPush,
      rebase: mockRebase,
    },
  };
});

const createWrapper = (queryClient: QueryClient) => {
  return function Wrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe('git mutation hooks attempt guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('useMerge rejects and does not call API when attemptId is missing', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useMerge(undefined, onSuccess, onError), {
      wrapper: createWrapper(createQueryClient()),
    });

    await expect(result.current.mutateAsync({ repoId: 'repo-1' })).rejects.toThrow(
      'Attempt id is not set'
    );

    expect(mockMerge).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it('usePush rejects and does not call API when attemptId is missing', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => usePush(undefined, onSuccess, onError), {
      wrapper: createWrapper(createQueryClient()),
    });

    await expect(
      result.current.mutateAsync({
        repo_id: 'repo-1',
      })
    ).rejects.toThrow('Attempt id is not set');

    expect(mockPush).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });

  it('useRebase rejects and does not call API when attemptId is missing', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(
      () => useRebase(undefined, 'repo-1', onSuccess, onError),
      {
        wrapper: createWrapper(createQueryClient()),
      }
    );

    await expect(
      result.current.mutateAsync({
        repoId: 'repo-1',
      })
    ).rejects.toMatchObject({
      success: false,
      message: 'Attempt id is not set',
    });

    expect(mockRebase).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
