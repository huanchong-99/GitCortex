// ============================================================================
// Workflow Constants
// ============================================================================

/**
 * CLI type definitions for terminal configuration
 * Matches backend BaseCodingAgent enum from shared/types.ts
 */
export const CLI_TYPES = {
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'Anthropic Claude Code CLI',
    icon: 'terminal',
  },
  'gemini-cli': {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    description: 'Google Gemini CLI',
    icon: 'terminal',
  },
  'codex': {
    id: 'codex',
    label: 'Codex',
    description: 'OpenAI Codex CLI',
    icon: 'terminal',
  },
  'amp': {
    id: 'amp',
    label: 'Amp',
    description: 'Sourcegraph Amp CLI',
    icon: 'terminal',
  },
  'cursor-agent': {
    id: 'cursor-agent',
    label: 'Cursor Agent',
    description: 'Cursor IDE Agent',
    icon: 'terminal',
  },
  'qwen-code': {
    id: 'qwen-code',
    label: 'Qwen Code',
    description: 'Alibaba Qwen Code CLI',
    icon: 'terminal',
  },
  'copilot': {
    id: 'copilot',
    label: 'Copilot',
    description: 'GitHub Copilot CLI',
    icon: 'terminal',
  },
  'droid': {
    id: 'droid',
    label: 'Droid',
    description: 'Droid AI CLI',
    icon: 'terminal',
  },
  'opencode': {
    id: 'opencode',
    label: 'Opencode',
    description: 'Opencode CLI',
    icon: 'terminal',
  },
} as const;

/** CLI type ID */
export type CliTypeId = keyof typeof CLI_TYPES;

/** Git commit format template */
export const GIT_COMMIT_FORMAT = `<type>(<scope>): <subject>

<body>

<footer>

Co-Authored-By: Claude <noreply@anthropic.com>`;

/** Git commit types */
export const GIT_COMMIT_TYPES = {
  feat: '新功能',
  fix: '修复',
  docs: '文档',
  style: '格式',
  refactor: '重构',
  perf: '性能优化',
  test: '测试',
  chore: '构建/工具',
} as const;
