// ============================================================================
// Workflow Constants
// ============================================================================

/** CLI type definitions for terminal configuration */
export const CLI_TYPES = {
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    description: 'Anthropic Claude Code CLI',
  },
  'gemini-cli': {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    description: 'Google Gemini CLI',
  },
  'codex': {
    id: 'codex',
    label: 'Codex',
    description: 'OpenAI Codex CLI',
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
