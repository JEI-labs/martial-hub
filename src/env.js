import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NEXTAUTH_SECRET: z.string(),
    AUTH_SECRET:
      process.env.NODE_ENV === 'production'
        ? z.string()
        : z.string().optional(),
    DATABASE_URL: z.string().url(),
    /**
     * Conexão direta (ou pooler em session mode) usada só pelas migrations.
     * O pooler em transaction mode não suporta o advisory lock do migrate.
     * Opcional: caindo para DATABASE_URL quando não definida.
     */
    DIRECT_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    BLOB_READ_WRITE_TOKEN: z.string(),
    /**
     * Evolution do próprio sistema, usada no fluxo de QR code: a academia
     * conecta o número sem ver URL nem token. Opcionais — sem elas o sistema
     * só oferece a conexão manual.
     */
    EVOLUTION_BASE_URL: z.string().url().optional(),
    EVOLUTION_API_KEY: z.string().optional(),
    /** Segredo da rota que dispara as mensagens automáticas. */
    CRON_SECRET: z.string().optional(),
    /**
     * Domínio onde moram os subdomínios das academias
     * (`academia.seusistema.com.br`). Sem ele, só domínio cadastrado resolve —
     * é o caso do ambiente local.
     */
    ROOT_DOMAIN: z.string().optional(),
    /**
     * Credenciais da Vercel para cadastrar o domínio próprio do cliente
     * sozinho. Sem elas, a tela do master só guarda o domínio e diz que falta
     * cadastrar na mão.
     */
    VERCEL_TOKEN: z.string().optional(),
    VERCEL_PROJECT_ID: z.string().optional(),
    VERCEL_TEAM_ID: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
    EVOLUTION_BASE_URL: process.env.EVOLUTION_BASE_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    ROOT_DOMAIN: process.env.ROOT_DOMAIN,
    VERCEL_TOKEN: process.env.VERCEL_TOKEN,
    VERCEL_PROJECT_ID: process.env.VERCEL_PROJECT_ID,
    VERCEL_TEAM_ID: process.env.VERCEL_TEAM_ID,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
