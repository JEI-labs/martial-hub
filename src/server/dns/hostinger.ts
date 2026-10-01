import 'server-only';

import { env } from '@/env';

/**
 * O DNS do subdomínio da academia, criado junto com ela.
 *
 * Só vale para endereços dentro do nosso domínio raiz: a zona do cliente não é
 * nossa, e o domínio próprio dele continua sendo ele quem aponta. Por isso
 * tudo aqui recusa um hostname de fora em vez de tentar e falhar no provedor.
 */

const API = 'https://developers.hostinger.com/api/dns/v1';

/** Para onde o subdomínio aponta. A Vercel dá um alvo por projeto; sem ele,
 *  o genérico atende. */
const ALVO = env.DNS_CNAME_TARGET ?? 'cname.vercel-dns.com';

export function dnsEnabled(): boolean {
  return Boolean(env.HOSTINGER_API_TOKEN && env.ROOT_DOMAIN);
}

/**
 * O nome do registro dentro da zona: `academia.seusistema.com.br` vira
 * `academia`. Devolve null para o que não mora na nossa zona.
 */
export function nomeNaZona(hostname: string): string | null {
  const raiz = env.ROOT_DOMAIN?.toLowerCase();
  if (!raiz) return null;

  const host = hostname.trim().toLowerCase();
  if (!host.endsWith(`.${raiz}`)) return null;

  const nome = host.slice(0, -(raiz.length + 1));
  return nome || null;
}

type Resultado = { ok: true } | { ok: false; error: string };

async function chamar(
  caminho: string,
  init: RequestInit,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const resposta = await fetch(`${API}${caminho}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${env.HOSTINGER_API_TOKEN}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      /* A tela espera por isto; sem teto, um provedor lento vira um botão
         girando para sempre. */
      signal: AbortSignal.timeout(15_000),
    });

    if (!resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as {
        message?: string;
      };

      return {
        ok: false,
        error: corpo.message ?? `Hostinger respondeu ${resposta.status}`,
      };
    }

    return { ok: true, error: null };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Falha ao falar com a Hostinger',
    };
  }
}

/**
 * Aponta o subdomínio para o nosso servidor.
 *
 * Apaga antes de criar porque o `PUT` acumula conteúdos no mesmo nome, e dois
 * CNAMEs no mesmo lugar é um registro inválido. Apagar o que não existe é
 * aceito pela API, então refazer é seguro.
 */
export async function apontarSubdominio(hostname: string): Promise<Resultado> {
  if (!dnsEnabled()) {
    return { ok: false, error: 'Integração com a Hostinger não configurada.' };
  }

  const nome = nomeNaZona(hostname);
  if (!nome) {
    return {
      ok: false,
      error: 'Este endereço não está no nosso domínio — o DNS é do cliente.',
    };
  }

  const zona = env.ROOT_DOMAIN;

  await chamar(`/zones/${zona}`, {
    method: 'DELETE',
    body: JSON.stringify({ filters: [{ name: nome, type: 'CNAME' }] }),
  });

  const criado = await chamar(`/zones/${zona}`, {
    method: 'PUT',
    body: JSON.stringify({
      overwrite: false,
      zone: [
        {
          name: nome,
          type: 'CNAME',
          ttl: 300,
          records: [{ content: `${ALVO}.` }],
        },
      ],
    }),
  });

  return criado.ok ? { ok: true } : { ok: false, error: criado.error! };
}

/** Tira o subdomínio do ar. Endereço de fora da nossa zona não é mexido. */
export async function removerSubdominio(hostname: string): Promise<Resultado> {
  if (!dnsEnabled()) {
    return { ok: false, error: 'Integração com a Hostinger não configurada.' };
  }

  const nome = nomeNaZona(hostname);
  if (!nome) return { ok: false, error: 'Endereço fora da nossa zona.' };

  const apagado = await chamar(`/zones/${env.ROOT_DOMAIN}`, {
    method: 'DELETE',
    body: JSON.stringify({ filters: [{ name: nome, type: 'CNAME' }] }),
  });

  return apagado.ok ? { ok: true } : { ok: false, error: apagado.error! };
}
