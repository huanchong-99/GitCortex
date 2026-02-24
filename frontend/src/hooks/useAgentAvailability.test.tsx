import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseCodingAgent } from 'shared/types';
import { useAgentAvailability } from './useAgentAvailability';

const { mockCheckAgentAvailability } = vi.hoisted(() => ({
  mockCheckAgentAvailability: vi.fn(),
}));

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    configApi: {
      ...actual.configApi,
      checkAgentAvailability: mockCheckAgentAvailability,
    },
  };
});

describe('useAgentAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAgentAvailability.mockRejectedValue(new Error('check failed'));
  });

  it('rechecks with latest error notifier when options change', async () => {
    const onErrorA = vi.fn();
    const onErrorB = vi.fn();

    const { rerender } = renderHook(
      ({ onError }) =>
        useAgentAvailability(BaseCodingAgent.CODEX, {
          onError,
        }),
      {
        initialProps: {
          onError: onErrorA,
        },
      }
    );

    await waitFor(() => {
      expect(onErrorA).toHaveBeenCalledTimes(1);
    });

    rerender({ onError: onErrorB });

    await waitFor(() => {
      expect(onErrorB).toHaveBeenCalledTimes(1);
    });
    expect(mockCheckAgentAvailability).toHaveBeenCalledTimes(2);
  });
});
