import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('legacy routes cleanup', () => {
  it('removes legacy projects routes and imports', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    // Legacy component imports should not exist
    expect(source).not.toMatch(/import.*Projects.*from/);
    expect(source).not.toMatch(/import.*ProjectTasks.*from/);
    // Legacy component usage should not exist (redirects are OK)
    expect(source).not.toMatch(/<Projects\s/);
    expect(source).not.toMatch(/<ProjectTasks\s/);
  });
});
