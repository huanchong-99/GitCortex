import { describe, it, expect } from 'vitest';
import {
  validateStep0Project,
  validateStep1Basic,
  validateStep2Tasks,
  validateStep3Models,
  validateStep6Advanced,
} from '../index';
import { getDefaultWizardConfig } from '../../types';

describe('workflow step validators', () => {
  it('validates project working directory', () => {
    const config = getDefaultWizardConfig();
    const errors = validateStep0Project(config);
    expect(errors.workingDirectory).toBeTruthy();
  });

  it('validates basic name and task count', () => {
    const config = getDefaultWizardConfig();
    config.basic.name = '';
    config.basic.taskCount = 0;
    const errors = validateStep1Basic(config);
    expect(errors.name).toBeTruthy();
    expect(errors.taskCount).toBeTruthy();
  });

  it('validates task list entries', () => {
    const config = getDefaultWizardConfig();
    config.tasks = [];
    const errors = validateStep2Tasks(config);
    expect(errors.tasks).toBeTruthy();
  });

  it('validates model configuration', () => {
    const config = getDefaultWizardConfig();
    config.models = [];
    const errors = validateStep3Models(config);
    expect(errors.models).toBeTruthy();
  });

  it('validates advanced orchestrator + merge config', () => {
    const config = getDefaultWizardConfig();
    config.advanced.orchestrator.modelConfigId = '';
    config.advanced.mergeTerminal.cliTypeId = '';
    config.advanced.mergeTerminal.modelConfigId = '';
    const errors = validateStep6Advanced(config);
    expect(errors.orchestratorModel).toBeTruthy();
    expect(errors.mergeCli).toBeTruthy();
    expect(errors.mergeModel).toBeTruthy();
  });
});
