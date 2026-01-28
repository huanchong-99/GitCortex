import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('legacy routes cleanup', () => {
  it('removes legacy projects routes and imports', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    expect(source).not.toMatch(/Projects/);
    expect(source).not.toMatch(/ProjectTasks/);
    expect(source).not.toMatch(/\/projects/);
  });
});
