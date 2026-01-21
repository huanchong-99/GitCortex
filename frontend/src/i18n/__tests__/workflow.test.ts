import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '@/i18n';

describe('workflow namespace', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('loads workflow translations', () => {
    expect(i18n.t('workflow:wizard.title')).toBe('Create Workflow');
  });
});
