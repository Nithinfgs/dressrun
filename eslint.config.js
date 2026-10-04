import js from '@eslint/js';

const nodeGlobals = Object.fromEntries(
  ['process', 'console', 'Buffer', 'setTimeout', 'clearTimeout', 'URL'].map((g) => [g, 'readonly']),
);

export default [
  { ignores: ['node_modules/**', 'docs/**', 'examples/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: nodeGlobals },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }] },
  },
];
