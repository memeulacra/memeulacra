import react from 'eslint-plugin-react'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
})

export default [{
  ignores: [
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/storybook-static/',
    '**/public/',
    '**/.next/'
  ],
}, ...compat.extends(
  'eslint:recommended',
  'plugin:react/recommended',
  'plugin:@typescript-eslint/recommended',
  'plugin:@next/next/recommended',
), {
  plugins: {
    react,
    '@typescript-eslint': typescriptEslint,
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      Atomics: 'readonly',
      SharedArrayBuffer: 'readonly',
    },

    parser: tsParser,
    ecmaVersion: 2020,
    sourceType: 'module',

    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },

  settings: {
    react: {
      version: '18.2.0',
    },
  },

  rules: {
    'no-debugger': 'warn',

    indent: ['error', 2, {
      SwitchCase: 2,
    }],

    'linebreak-style': ['error', 'unix'],
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-unused-vars': 'off',
    'no-extra-bind': 'warn',
    'jsx-a11y/href-no-hash': 0,
    'jsx-a11y/anchor-is-valid': 0,
    eqeqeq: 'off',
    'array-callback-return': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/ban-types': 'off',
    'react-hooks/exhaustive-deps': 'off',
    '@typescript-eslint/no-namespace': 'off',
    'no-restricted-globals': 'off',
    'no-mixed-operators': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    'no-extend-native': 'off',
    'no-prototype-builtins': 'off',
    'import/no-anonymous-default-export': 'off',
    'no-inner-declarations': 'off',
    'no-throw-literal': 'off',
  },
}]
