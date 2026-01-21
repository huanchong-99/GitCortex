import { describe, it, expect } from 'vitest';

describe('browserslist env', () => {
  it('sets BROWSERSLIST_IGNORE_OLD_DATA to silence outdated warnings', () => {
    expect(process.env.BROWSERSLIST_IGNORE_OLD_DATA).toBe('1');
  });
});
