import { describe, it, expect } from 'vitest';
import { validateStep4Terminals } from '../step4Terminals';
import { getDefaultWizardConfig } from '../../types';
import type { WizardConfig } from '../../types';

describe('validateStep4Terminals', () => {
  it('returns errors when terminal config missing cli/model', () => {
    const config: WizardConfig = {
      ...getDefaultWizardConfig(),
      terminals: [
        {
          id: 't1',
          taskId: 'task1',
          orderIndex: 0,
          cliTypeId: '',
          modelConfigId: '',
        },
      ],
    };

    const errors = validateStep4Terminals(config);

    expect(errors['terminal-0-cli']).toBeTruthy();
    expect(errors['terminal-0-model']).toBeTruthy();
  });
});
