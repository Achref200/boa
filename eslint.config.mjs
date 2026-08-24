import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      /* The codebase already uses a leading underscore to mean "deliberately
         unused" — mostly `const { blockId: _blockId, ...rest }` to drop a key
         before returning a row. Without this the convention reads as seven
         warnings, which trains everyone to ignore the linter. */
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  /* src/db/types.ts is emitted by `npm run db:types` from the live schema, the
     same way src/generated/** is. Linting a generated file only ever produces
     warnings nobody can act on without editing a file marked do-not-edit. */
  { ignores: ['.next/**', 'node_modules/**', 'src/generated/**', 'src/db/types.ts'] },
];
