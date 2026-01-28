import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('no vibe-kanban companion dependency', () => {
  it('removes dependency from package.json', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.dependencies?.['vibe-kanban-web-companion']).toBeUndefined();
  });

  it('removes import from main.tsx', () => {
    const source = readFileSync('src/main.tsx', 'utf8');
    expect(source).not.toMatch(/vibe-kanban-web-companion/);
  });
});
