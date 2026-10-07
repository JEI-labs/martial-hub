import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { TEST_DATABASE_URL } from './src/test/database';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    /* Os arquivos dividem o mesmo banco; um de cada vez evita disputa. */
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
      SKIP_ENV_VALIDATION: '1',
      NODE_ENV: 'test',
    },
  },
});
