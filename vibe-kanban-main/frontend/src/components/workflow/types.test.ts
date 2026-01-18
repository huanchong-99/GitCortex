// src/components/workflow/types.test.ts
import { describe, it, expect } from 'vitest';
import {
  WizardStep,
  WIZARD_STEPS,
  getDefaultWizardConfig,
} from './types';

describe('Workflow Types', () => {
  describe('WizardStep enum', () => {
    it('should have all 7 steps defined', () => {
      expect(WizardStep.Project).toBe(0);
      expect(WizardStep.Basic).toBe(1);
      expect(WizardStep.Tasks).toBe(2);
      expect(WizardStep.Models).toBe(3);
      expect(WizardStep.Terminals).toBe(4);
      expect(WizardStep.Commands).toBe(5);
      expect(WizardStep.Advanced).toBe(6);
    });
  });

  describe('WIZARD_STEPS metadata', () => {
    it('should have 7 steps with correct metadata', () => {
      expect(WIZARD_STEPS).toHaveLength(7);
      expect(WIZARD_STEPS[0]).toEqual({
        step: WizardStep.Project,
        name: '工作目录',
        description: '选择项目文件夹'
      });
    });
  });

  describe('getDefaultWizardConfig', () => {
    it('should return config with all required fields', () => {
      const config = getDefaultWizardConfig();

      expect(config).toHaveProperty('project');
      expect(config).toHaveProperty('basic');
      expect(config).toHaveProperty('tasks');
      expect(config).toHaveProperty('models');
      expect(config).toHaveProperty('terminals');
      expect(config).toHaveProperty('commands');
      expect(config).toHaveProperty('advanced');
    });

    it('should set default basic config with 1 task', () => {
      const config = getDefaultWizardConfig();
      expect(config.basic.taskCount).toBe(1);
      expect(config.basic.importFromKanban).toBe(false);
    });

    it('should set default target branch to main', () => {
      const config = getDefaultWizardConfig();
      expect(config.advanced.targetBranch).toBe('main');
    });
  });
});
