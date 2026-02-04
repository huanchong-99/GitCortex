// ============================================================================
// 工作流向导类型定义
// 对应设计文档 2026-01-16-orchestrator-design.md 第 11 章
// ============================================================================

/** 向导步骤枚举 */
export enum WizardStep {
  Project = 0,      // 步骤0: 工作目录
  Basic = 1,        // 步骤1: 基础配置
  Tasks = 2,        // 步骤2: 任务配置
  Models = 3,       // 步骤3: 模型配置
  Terminals = 4,    // 步骤4: 终端配置
  Commands = 5,     // 步骤5: 斜杠命令
  Advanced = 6,     // 步骤6: 高级配置
}

/** 向导步骤元数据 */
export const WIZARD_STEPS = [
  {
    step: WizardStep.Project,
    nameKey: 'steps.project.name',
    descriptionKey: 'steps.project.description',
  },
  {
    step: WizardStep.Basic,
    nameKey: 'steps.basic.name',
    descriptionKey: 'steps.basic.description',
  },
  {
    step: WizardStep.Tasks,
    nameKey: 'steps.tasks.name',
    descriptionKey: 'steps.tasks.description',
  },
  {
    step: WizardStep.Models,
    nameKey: 'steps.models.name',
    descriptionKey: 'steps.models.description',
  },
  {
    step: WizardStep.Terminals,
    nameKey: 'steps.terminals.name',
    descriptionKey: 'steps.terminals.description',
  },
  {
    step: WizardStep.Commands,
    nameKey: 'steps.commands.name',
    descriptionKey: 'steps.commands.description',
  },
  {
    step: WizardStep.Advanced,
    nameKey: 'steps.advanced.name',
    descriptionKey: 'steps.advanced.description',
  },
] as const;

/** Git 仓库状态 */
export interface GitStatus {
  isGitRepo: boolean;
  currentBranch?: string;
  remoteUrl?: string;
  isDirty: boolean;
  uncommittedChanges?: number;
}

/** 项目配置 (步骤0) */
export interface ProjectConfig {
  workingDirectory: string;
  gitStatus: GitStatus;
}

/** 基础配置 (步骤1) */
export interface BasicConfig {
  name: string;
  description?: string;
  taskCount: number;
  importFromKanban: boolean;
  kanbanTaskIds?: string[];
}

/** 任务配置 (步骤2) */
export interface TaskConfig {
  id: string;           // 临时 ID，用于前端标识
  name: string;
  description: string;  // AI 将根据此描述执行任务
  branch: string;       // Git 分支名
  terminalCount: number; // 此任务的串行终端数量
}

/** API 类型 */
export type ApiType = 'anthropic' | 'google' | 'openai' | 'openai-compatible';

/** 模型配置 (步骤3) */
export interface ModelConfig {
  id: string;           // 临时 ID
  displayName: string;  // 用户自定义显示名
  apiType: ApiType;
  baseUrl: string;
  apiKey: string;
  modelId: string;      // 实际模型 ID
  isVerified: boolean;  // 是否已验证连接
}

/** 终端配置 (步骤4) */
export interface TerminalConfig {
  id: string;           // 临时 ID
  taskId: string;       // 关联的任务 ID
  orderIndex: number;   // 在任务内的执行顺序
  cliTypeId: string;    // CLI 类型 (claude-code, gemini-cli, codex)
  modelConfigId: string; // 关联的模型配置 ID
  role?: string;        // 角色描述
}

/** 斜杠命令配置 (步骤5) */
export interface CommandConfig {
  enabled: boolean;
  presetIds: string[];  // 选中的命令预设 ID（按顺序）
  customDescriptions?: Record<string, string>; // presetId -> 用户自定义描述
  additionalCommands?: Record<string, string[]>; // presetId -> 额外的斜杠命令列表
  customParams?: Record<string, Record<string, unknown>>; // presetId -> JSON object (高级)
}

/** 高级配置 (步骤6) */
export interface AdvancedConfig {
  orchestrator: {
    modelConfigId: string; // 主 Agent 使用的模型
  };
  errorTerminal: {
    enabled: boolean;
    cliTypeId?: string;
    modelConfigId?: string;
  };
  mergeTerminal: {
    cliTypeId: string;
    modelConfigId: string;
    runTestsBeforeMerge: boolean;
    pauseOnConflict: boolean;
  };
  targetBranch: string;
}

/** 完整的向导配置 */
export interface WizardConfig {
  project: ProjectConfig;
  basic: BasicConfig;
  tasks: TaskConfig[];
  models: ModelConfig[];
  terminals: TerminalConfig[];
  commands: CommandConfig;
  advanced: AdvancedConfig;
}

/** 向导状态 */
export interface WizardState {
  currentStep: WizardStep;
  config: WizardConfig;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

/** 获取默认向导配置 */
export function getDefaultWizardConfig(): WizardConfig {
  return {
    project: {
      workingDirectory: '',
      gitStatus: { isGitRepo: false, isDirty: false },
    },
    basic: {
      name: '',
      taskCount: 1,
      importFromKanban: false,
    },
    tasks: [],
    models: [],
    terminals: [],
    commands: {
      enabled: false,
      presetIds: [],
    },
    advanced: {
      orchestrator: { modelConfigId: '' },
      errorTerminal: { enabled: false },
      mergeTerminal: {
        cliTypeId: '',
        modelConfigId: '',
        runTestsBeforeMerge: true,
        pauseOnConflict: true,
      },
      targetBranch: 'main',
    },
  };
}

// ============================================================================
// API Request Types (from useWorkflows.ts)
// ============================================================================

import type { CreateWorkflowRequest, InlineModelConfig } from '@/hooks/useWorkflows';

/**
 * Transform WizardConfig to CreateWorkflowRequest
 * Matches backend API contract at workflows_dto.rs
 */
export function wizardConfigToCreateRequest(
  projectId: string,
  config: WizardConfig
): CreateWorkflowRequest {
  // Build orchestrator config from models
  const orchestratorModel = config.models.find(m => m.id === config.advanced.orchestrator.modelConfigId);
  if (!orchestratorModel) {
    throw new Error('Orchestrator model not found in configured models');
  }

  // Helper to create inline model config from model ID
  const toInlineModelConfig = (modelConfigId?: string): InlineModelConfig | undefined => {
    const model = config.models.find(m => m.id === modelConfigId);
    return model
      ? { displayName: model.displayName, modelId: model.modelId }
      : undefined;
  };

  const request: CreateWorkflowRequest = {
    projectId,
    name: config.basic.name,
    description: config.basic.description,
    useSlashCommands: config.commands.enabled,
    commandPresetIds: config.commands.presetIds.length > 0 ? config.commands.presetIds : undefined,
    commands: config.commands.presetIds.map((presetId, index) => ({
      presetId,
      orderIndex: index,
      customParams: config.commands.customParams?.[presetId]
        ? JSON.stringify(config.commands.customParams[presetId])
        : null,
    })),
    orchestratorConfig: {
      apiType: orchestratorModel.apiType,
      baseUrl: orchestratorModel.baseUrl,
      apiKey: orchestratorModel.apiKey,
      model: orchestratorModel.modelId,
    },
    errorTerminalConfig: config.advanced.errorTerminal.enabled ? {
      cliTypeId: config.advanced.errorTerminal.cliTypeId!,
      modelConfigId: config.advanced.errorTerminal.modelConfigId!,
      modelConfig: toInlineModelConfig(config.advanced.errorTerminal.modelConfigId),
      customBaseUrl: null,
      customApiKey: null,
    } : undefined,
    mergeTerminalConfig: {
      cliTypeId: config.advanced.mergeTerminal.cliTypeId,
      modelConfigId: config.advanced.mergeTerminal.modelConfigId,
      modelConfig: toInlineModelConfig(config.advanced.mergeTerminal.modelConfigId),
      customBaseUrl: null,
      customApiKey: null,
    },
    targetBranch: config.advanced.targetBranch,
    tasks: config.tasks
      .sort((a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]))
      .map((task, taskIndex) => {
        // Find terminals for this task
        const taskTerminals = config.terminals
          .filter(t => t.taskId === task.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);

        if (taskTerminals.length === 0) {
          throw new Error(`Task "${task.name}" has no terminals assigned`);
        }

        return {
          name: task.name,
          description: task.description,
          branch: task.branch,
          orderIndex: taskIndex,
          terminals: taskTerminals.map(terminal => {
            const model = config.models.find(m => m.id === terminal.modelConfigId);
            if (!model) {
              throw new Error(`Model not found for terminal ${terminal.id}`);
            }

            return {
              cliTypeId: terminal.cliTypeId,
              modelConfigId: terminal.modelConfigId,
              modelConfig: {
                displayName: model.displayName,
                modelId: model.modelId,
              },
              customBaseUrl: model.baseUrl || null,
              customApiKey: model.apiKey || null,
              role: terminal.role,
              roleDescription: undefined,
              orderIndex: terminal.orderIndex,
            };
          }),
        };
      }),
  };

  return request;
}
