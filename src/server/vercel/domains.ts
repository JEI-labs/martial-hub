import 'server-only';

import { env } from '@/env';

/**
 * Domínio próprio do cliente entrando no ar sozinho.
 *
 * O fluxo da Vercel tem dois lados: o domínio precisa estar cadastrado no
 * projeto (senão o roteamento nem chega até nós) e o DNS do cliente precisa
 * apontar para lá (senão o certificado não sai). A API diz os dois, então a
 * tela do master consegue mostrar em qual dos dois a coisa parou em vez de
 * um "não funciona" genérico.
 */

const API = 'https://api.vercel.com';

export function vercelEnabled(): boolean {
  return Boolean(env.VERCEL_TOKEN && env.VERCEL_PROJECT_ID);
}

function querystring(): string {
  return env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : '';
}

async function chamar<T>(
  caminho: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!vercelEnabled()) {
    return { ok: false, error: 'Integração com a Vercel não configurada.' };
  }

  try {
    const resposta = await fetch(`${API}${caminho}${querystring()}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      // a tela espera por isto; sem teto, um timeout da Vercel vira um botão
      // girando para sempre
      signal: AbortSignal.timeout(15_000),
    });

    const corpo = (await resposta.json().catch(() => ({}))) as
      T | { error?: { message?: string; code?: string } };

    if (!resposta.ok) {
      const erro = (corpo as { error?: { message?: string } }).error;
      return {
        ok: false,
        error: erro?.message ?? `Vercel respondeu ${resposta.status}`,
      };
    }

    return { ok: true, data: corpo as T };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Falha ao falar com a Vercel',
    };
  }
}

/** Cadastra o domínio no projeto. Já cadastrado conta como sucesso. */
export async function addDomain(hostname: string) {
  const resultado = await chamar<{ name: string }>(
    `/v10/projects/${env.VERCEL_PROJECT_ID}/domains`,
    { method: 'POST', body: JSON.stringify({ name: hostname }) },
  );

  if (
    !resultado.ok &&
    /already in use by this project|already exists/i.test(resultado.error)
  ) {
    return { ok: true as const, data: { name: hostname } };
  }

  return resultado;
}

export async function removeDomain(hostname: string) {
  return chamar(`/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${hostname}`, {
    method: 'DELETE',
  });
}

export type DomainStatus = {
  /** Cadastrado no projeto da Vercel. */
  registrado: boolean;
  /** DNS do cliente já aponta para a Vercel. */
  dnsOk: boolean;
  /** O que o cliente precisa criar no DNS, quando ainda falta. */
  instrucao: string | null;
  erro: string | null;
};

/**
 * Em que pé está o domínio. `misconfigured` é a resposta da Vercel para "o
 * domínio está aqui, mas o DNS do cliente ainda não aponta para mim".
 */
export async function domainStatus(hostname: string): Promise<DomainStatus> {
  const projeto = await chamar<{ name: string; verified?: boolean }>(
    `/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${hostname}`,
  );

  if (!projeto.ok) {
    return {
      registrado: false,
      dnsOk: false,
      instrucao: null,
      erro: projeto.error,
    };
  }

  const config = await chamar<{ misconfigured?: boolean }>(
    `/v6/domains/${hostname}/config`,
  );

  if (!config.ok) {
    return {
      registrado: true,
      dnsOk: false,
      instrucao: null,
      erro: config.error,
    };
  }

  const dnsOk = config.data.misconfigured === false;

  return {
    registrado: true,
    dnsOk,
    instrucao: dnsOk
      ? null
      : `Crie um CNAME de ${hostname} apontando para cname.vercel-dns.com`,
    erro: null,
  };
}
