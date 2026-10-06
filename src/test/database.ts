/**
 * Banco dos testes: o `postgres-test` do docker-compose. Fica escrito aqui, e
 * não lido do `.env`, para um teste nunca cair no banco no ar por engano.
 */
export const TEST_DATABASE_URL = 'postgresql://test:test@localhost:5435/test';
