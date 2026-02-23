import { describe, it, expect } from 'vitest';
import { paths } from './paths';

describe('paths', () => {
  it('generates board path', () => {
    expect(paths.board()).toBe('/board');
  });

  it('generates workflow management entry paths', () => {
    expect(paths.wizard()).toBe('/wizard');
    expect(paths.workflows()).toBe('/workflows');
  });

  it('generates pipeline path for workflow', () => {
    expect(paths.pipeline('wf-123')).toBe('/pipeline/wf-123');
  });

  it('generates debug path for workflow', () => {
    expect(paths.debug('wf-123')).toBe('/debug/wf-123');
  });

  it('generates settings paths', () => {
    expect(paths.settings()).toBe('/settings');
    expect(paths.settings('general')).toBe('/settings/general');
    expect(paths.settings('projects')).toBe('/settings/projects');
  });

  it('generates workspaces paths', () => {
    expect(paths.workspaces()).toBe('/workspaces');
    expect(paths.workspacesCreate()).toBe('/workspaces/create');
    expect(paths.workspaces('create')).toBe('/workspaces/create');
    expect(paths.workspaces('ws-123')).toBe('/workspaces/ws-123');
  });
});
