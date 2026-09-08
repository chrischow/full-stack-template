import { baseConfig } from '@repo/eslint-config/base'
import { defineConfig } from 'eslint/config'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  ...baseConfig,

  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
       'react-refresh/only-export-components': 'warn',
     },
  },
])
