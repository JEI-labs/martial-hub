import { execSync } from 'node:child_process';

import { TEST_DATABASE_URL } from './database';

/**
 * Antes de qualquer teste: confere que o banco é local e aplica as migrations
 * nele. As mesmas migrations que vão para o ar — se uma delas quebrar, os
 * testes quebram antes.
 */
export default function setup() {
  const url = TEST_DATABASE_URL;
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  })();

  /* Os testes criam e apagam academias. Fora de localhost, não rodam. */
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `Os testes só rodam contra banco local, e o banco de teste aponta para "${host || url}".`,
    );
  }

  /* DIRECT_URL também: o prisma.config.ts prefere ela, e o dotenv dele não
     sobrescreve o que já veio definido aqui. */
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
