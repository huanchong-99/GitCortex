import { existsSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const legacyPaths = [
  'src/components/projects',
  'src/components/tasks/TaskKanbanBoard.tsx',
  'src/components/layout/TasksLayout.tsx',
  'src/components/ui/shadcn-io/kanban',
];

describe('legacy kanban components cleanup', () => {
  it('removes legacy files and directories', () => {
    legacyPaths.forEach((path) => {
      expect(existsSync(path)).toBe(false);
    });
  });

  it('removes kanban directory from shadcn-io', () => {
    const shadcnIoDir = 'src/components/ui/shadcn-io';
    expect(existsSync(shadcnIoDir)).toBe(true);

    const entries = readdirSync(shadcnIoDir);
    expect(entries).not.toContain('kanban');
  });
});
