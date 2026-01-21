const path = require('path');
const base = require('./.eslintrc.cjs');

module.exports = {
  ...base,
  parserOptions: {
    ...base.parserOptions,
    project: [
      path.join(__dirname, 'tsconfig.json'),
      path.join(__dirname, 'tsconfig.node.json'),
    ],
  },
  extends: base.extends,
  overrides: [
    ...base.overrides,
    {
      files: [
        'src/components/workflow/**/*.{ts,tsx}',
        'src/components/terminal/**/*.{ts,tsx}',
        'src/pages/WorkflowDebug*.tsx',
      ],
      extends: [
        'plugin:@typescript-eslint/strict-type-checked',
        'plugin:@typescript-eslint/stylistic-type-checked',
      ],
    },
    {
      files: ['*.config.{ts,js,cjs,mjs}', 'vite.config.ts', 'vitest.config.ts'],
      parserOptions: {
        project: [path.join(__dirname, 'tsconfig.node.json')],
      },
      rules: {
        '@typescript-eslint/switch-exhaustiveness-check': 'off',
      },
    },
  ],
};
