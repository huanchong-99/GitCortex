import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('no gitcortex companion dependency', () => {
  it('removes dependency from package.json', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.dependencies?.['gitcortex-web-companion']).toBeUndefined();
  });

  it('removes import from main.tsx', () => {
    const source = readFileSync('src/main.tsx', 'utf8');
    expect(source).not.toMatch(/gitcortex-web-companion/);
  });
});
