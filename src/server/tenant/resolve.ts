import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

import { prisma } from '@/server/db';
import { env } from '@/env';

export type ResolvedTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  branding: {
    logoUrl: string | null;
    loginImageUrl: string | null;
    primaryColor: string | null;
  } | null;
};

/** Tira porta e `www.`: o host chega como `academia.sistema.com.br:3000`. */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;

  const limpo = host.trim().toLowerCase().split(':')[0] ?? '';
  const semWww = limpo.startsWith('www.') ? limpo.slice(4) : limpo;

  return semWww || null;
}

/**
 * O endereço do painel do dono do sistema.
 *
 * `app.<raiz>` é só o padrão: o painel pode morar em outro domínio, e aí nada
 * nele se parece com o endereço de um cliente.
 */
export function masterHost(): string | null {
  if (env.MASTER_HOST) {
    /* Quem preenche isto é gente, e gente cola endereço inteiro. Sem tirar o
       esquema antes, o corte da porta transformaria `https://casa.com` em
       `https` e o master seria mandado para um host que não existe. */
    const semEsquema = env.MASTER_HOST.trim().replace(
      /^[a-z][a-z0-9+.-]*:\/\//i,
      '',
    );
    return normalizeHost(semEsquema.split('/')[0]);
  }

  return env.ROOT_DOMAIN ? `app.${env.ROOT_DOMAIN.toLowerCase()}` : null;
}

/**
 * Subdomínio da academia dentro do nosso domínio raiz. Um domínio próprio não
 * cai aqui — ele é encontrado pela tabela de domínios.
 */
export function slugFromHost(host: string): string | null {
  const raiz = env.ROOT_DOMAIN?.toLowerCase();
  if (!raiz || !host.endsWith(`.${raiz}`)) return null;

  const slug = host.slice(0, -(raiz.length + 1));

  /* A casa do master não é academia nenhuma — nem quando ela mora dentro do
     domínio raiz, caso em que uma academia com esse slug a esconderia. */
  if (!slug || slug.includes('.') || slug === 'app' || slug === 'www') {
    return null;
  }

  if (host === masterHost()) return null;

  return slug;
}

/**
 * Qual academia atende este endereço.
 *
 * Duas portas de entrada, na ordem: o domínio cadastrado (que cobre tanto o
 * subdomínio nosso quanto o domínio próprio do cliente) e, como rede de
 * segurança, o slug lido do host — assim uma academia recém-criada funciona
 * mesmo que a linha de domínio ainda não exista.
 *
 * `cache` é por requisição: o layout, a página e o login resolvem o mesmo
 * host sem três idas ao banco.
 */
export const getTenantByHost = cache(
  async (hostBruto: string | null): Promise<ResolvedTenant | null> => {
    const host = normalizeHost(hostBruto);
    if (!host) return null;

    const select = {
      id: true,
      name: true,
      slug: true,
      status: true,
      branding: {
        select: { logoUrl: true, loginImageUrl: true, primaryColor: true },
      },
    };

    const porDominio = await prisma.tenantDomain.findUnique({
      where: { hostname: host },
      select: { tenant: { select } },
    });

    if (porDominio?.tenant) return porDominio.tenant;

    const slug = slugFromHost(host);
    if (!slug) return null;

    return prisma.tenant.findUnique({ where: { slug }, select });
  },
);

/** O tenant da requisição atual, para Server Components. */
export async function getCurrentTenant(): Promise<ResolvedTenant | null> {
  const lista = await headers();
  return getTenantByHost(lista.get('host'));
}
