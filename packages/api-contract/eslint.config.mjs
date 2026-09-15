import { baseConfig } from '@repo/eslint-config/base'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import globals from 'globals'

export default defineConfig([
  ...baseConfig,
  {
    files: ["**/*.ts"],
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
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "off",
    }
  }
])
