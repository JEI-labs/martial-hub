import js from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import tseslint from 'typescript-eslint';

/**
 * ESLint 9 flat config, replacing `.eslintrc.cjs` + `.eslintignore`.
 * Next 16 removed `next lint`, so this is driven straight from the ESLint CLI.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      // shadcn/ui primitives are vendored as-is
      'src/components/ui/**',
      'commitlint.config.js',
    ],
  },

  js.configs.recommended,
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierConfig,

  {
    plugins: { prettier: prettierPlugin },
    rules: {
      // JavaScript rules
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-unused-vars': 'off', // superseded by the TS-aware rule below
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'object-shorthand': 'warn',
      // 'consistent-as-needed' espelha o quoteProps: 'consistent' do prettier.
      // Com 'as-needed' as duas ferramentas se desfaziam a cada commit em
      // objetos que misturam chaves com e sem hífen.
      'quote-props': ['warn', 'consistent-as-needed'],

      // TypeScript rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/array-type': ['warn', { default: 'generic' }],
      '@typescript-eslint/consistent-type-assertions': [
        'warn',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],

      // React rules
      'react/jsx-fragments': ['warn', 'syntax'],
      'react/jsx-filename-extension': ['warn', { extensions: ['ts', 'tsx'] }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      'prettier/prettier': 'warn',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
);
