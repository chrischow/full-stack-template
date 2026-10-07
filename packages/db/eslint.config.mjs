import { baseConfig } from '@repo/eslint-config/base'
import tsParser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import globals from 'globals'

export default defineConfig([
  ...baseConfig,
  {
    ignores: ['index.js', 'index.d.ts', 'prisma/migrations/**/*'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
])
