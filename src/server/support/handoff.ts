import 'server-only';

import { encode, decode } from 'next-auth/jwt';

import { env } from '@/env';

/**
 * Entrada de suporte: como o master atravessa do endereço dele para o da
 * academia.
 *
 * O cookie de sessão é do host, e o host do master não é o da academia — nem
 * poderia ser, já que cliente com domínio próprio está em outro domínio
 * registrável. Então a travessia é por um bilhete assinado, de vida curta: o
 * master recebe um na casa dele e o troca por sessão na casa do cliente.
 *
 * A sessão que nasce de lá continua sendo a dele, com o papel MASTER e um
 * `supportTenantId` apontando para a academia — ninguém vira o dono dela, e
 * o rastro no banco diz quem entrou.
 */

const VIDA_DO_BILHETE = 60; // segundos

type Bilhete = {
  sub: string;
  tenantId: string;
  proposito: 'suporte';
};

export async function criarBilheteDeSuporte(
  userId: string,
  tenantId: string,
): Promise<string> {
  return encode({
    token: { sub: userId, tenantId, proposito: 'suporte' },
    secret: env.NEXTAUTH_SECRET,
    maxAge: VIDA_DO_BILHETE,
  });
}

export async function lerBilheteDeSuporte(
  bilhete: string,
): Promise<Bilhete | null> {
  try {
    const conteudo = await decode({
      token: bilhete,
      secret: env.NEXTAUTH_SECRET,
    });

    if (
      !conteudo ||
      conteudo.proposito !== 'suporte' ||
      typeof conteudo.sub !== 'string' ||
      typeof conteudo.tenantId !== 'string'
    ) {
      return null;
    }

    return {
      sub: conteudo.sub,
      tenantId: conteudo.tenantId,
      proposito: 'suporte',
    };
  } catch {
    return null;
  }
}

/** Nome do cookie de sessão, que muda em HTTPS. */
export function nomeDoCookieDeSessao(seguro: boolean): string {
  return seguro
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
}

/** A sessão que o master passa a ter dentro da academia. */
export async function criarSessaoDeSuporte(usuario: {
  id: string;
  name: string;
  email: string;
  tenantId: string;
}): Promise<string> {
  return encode({
    token: {
      id: usuario.id,
      name: usuario.name,
      email: usuario.email,
      role: 'MASTER',
      tenantId: null,
      supportTenantId: usuario.tenantId,
    },
    secret: env.NEXTAUTH_SECRET,
    // mesma duração da sessão normal do sistema
    maxAge: 24 * 60 * 60,
  });
}
