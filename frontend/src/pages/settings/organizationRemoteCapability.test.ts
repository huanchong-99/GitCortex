import { describe, expect, it } from 'vitest';
import { isRemoteProjectCapabilityUnsupported } from './organizationRemoteCapability';

describe('isRemoteProjectCapabilityUnsupported', () => {
  it('returns true for remote project unsupported errors', () => {
    expect(
      isRemoteProjectCapabilityUnsupported(
        'Remote project linking is not supported in this version.'
      )
    ).toBe(true);
  });

  it('returns true for remote organization unsupported errors', () => {
    expect(
      isRemoteProjectCapabilityUnsupported(
        new Error(
          'Remote organization features are not supported in this version.'
        )
      )
    ).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(
      isRemoteProjectCapabilityUnsupported('Failed to load remote projects')
    ).toBe(false);
  });
});
