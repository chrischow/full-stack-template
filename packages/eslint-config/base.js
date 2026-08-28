import js from '@eslint/js'
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort'

export const baseConfig = [
  {
    ignores: ['**/dist/**', '**/build/**', '**/node_modules/**', 'commitlint.config.js'],
  },
  js.configs.recommended,

  // Import sort
  {
    plugins: {
      'simple-import-sort': eslintPluginSimpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
]
