import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', '.tmp', '.temp', '*.tmp']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // useLatest 模式（渲染期间同步 ref.current）在本项目中广泛使用，
      // React Compiler 的严格规则与此冲突，降级为 warn
      'react-hooks/refs': 'warn',
      // React Compiler 的严格规则与现有模式冲突，降级为 warn
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/static-components': 'warn',
      // prefer-const 历史代码较多，降为 warn
      'prefer-const': 'warn',
      // 项目历史债务：大量 any 存在于 abilities/domain 层，暂降为 warn 避免阻塞提交
      '@typescript-eslint/no-explicit-any': 'warn',
      // 允许 _ 前缀的未使用变量（常见的占位参数模式）
      // 历史债务较多，降为 warn 避免阻塞提交
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // Vite HMR 提示，不影响运行，降为 warn
      'react-refresh/only-export-components': 'warn',
      // @ts-ignore → @ts-expect-error，历史代码较多，降为 warn
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
  // 测试文件放宽规则：允许 any 和 require()，减少测试代码噪音
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },
])
