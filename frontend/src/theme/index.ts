import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        slate: {
          50: { value: 'oklch(0.602 0.025 278.679)' },
          100: { value: 'oklch(0.547 0.029 278.679)' },
          200: { value: 'oklch(0.492 0.033 278.679)' },
          300: { value: 'oklch(0.437 0.03 278.679)' },
          400: { value: 'oklch(0.381 0.026 278.679)' },
          500: { value: 'oklch(0.326 0.023 278.679)' },
          600: { value: 'oklch(0.271 0.019 278.679)' },
          700: { value: 'oklch(0.216 0.015 278.679)' },
          800: { value: 'oklch(0.16 0.011 278.679)' },
          900: { value: 'oklch(0.105 0.007 278.679)' },
          950: { value: 'oklch(0.05 0.003 278.679)' },
        },
        indigo: {
          50: { value: 'oklch(0.95 0.016 275.206)' },
          100: { value: 'oklch(0.872 0.042 275.206)' },
          200: { value: 'oklch(0.793 0.069 275.206)' },
          300: { value: 'oklch(0.715 0.098 275.206)' },
          400: { value: 'oklch(0.637 0.13 275.206)' },
          500: { value: 'oklch(0.559 0.162 275.206)' },
          600: { value: 'oklch(0.48 0.197 275.206)' },
          700: { value: 'oklch(0.402 0.167 275.206)' },
          800: { value: 'oklch(0.324 0.135 275.206)' },
          900: { value: 'oklch(0.246 0.102 275.206)' },
          950: { value: 'oklch(0.167 0.07 275.206)' },
        },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: {
            value: {
              _light: '#ffffff',
              _dark: '{colors.slate.700}',
            },
          },
          panel: {
            value: {
              _light: '#ffffff',
              _dark: '{colors.slate.700}',
            },
          },
        },
        brand: {
          solid: { value: '{colors.indigo.500}' },
          contrast: { value: '{white}' },
          fg: { value: '{colors.indigo.700}' },
          muted: { value: '{colors.indigo.200}' },
          subtle: { value: '{colors.indigo.100}' },
          emphasized: { value: '{colors.indigo.300}' },
          focusRing: { value: '{colors.indigo.500}' },
        },
        success: {
          solid: { value: '{colors.teal.600}' },
          contrast: { value: '{white}' },
          fg: { value: '{colors.teal.700}' },
          muted: { value: '{colors.teal.200}' },
          subtle: { value: '{colors.teal.100}' },
          emphasized: { value: '{colors.teal.300}' },
          focusRing: { value: '{colors.teal.500}' },
        },
        warning: {
          solid: { value: '{colors.yellow.400}' },
          contrast: { value: '{black}' },
          fg: { value: '{colors.yellow.800}' },
          muted: { value: '{colors.yellow.200}' },
          subtle: { value: '{colors.yellow.100}' },
          emphasized: { value: '{colors.yellow.300}' },
          focusRing: { value: '{colors.yellow.500}' },
        },
        critical: {
          solid: { value: '{colors.red.600}' },
          contrast: { value: '{white}' },
          fg: { value: '{colors.red.700}' },
          muted: { value: '{colors.red.200}' },
          subtle: { value: '{colors.red.100}' },
          emphasized: { value: '{colors.red.300}' },
          focusRing: { value: '{colors.red.500}' },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
