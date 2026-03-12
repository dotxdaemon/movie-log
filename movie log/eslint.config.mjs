// ABOUTME: Defines the lint rules for the desktop app source, Electron process, and tests.
// ABOUTME: Keeps TypeScript and React files consistent without depending on type-aware linting.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'dist-electron', 'output', 'node_modules']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }]
    }
  },
  {
    files: ['electron/**/*.{ts,cjs}', 'shared/**/*.ts', 'scripts/**/*.mjs', 'tests/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['electron/**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
);
