import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/env';
import { nomeDoCookieDeSessao } from '@/server/support/handoff';

/** Encerra o acesso de suporte e devolve o master para a casa dele. */
export async function GET(request: NextRequest) {
  const seguro = request.nextUrl.protocol === 'https:';
  const porta = request.nextUrl.port ? `:${request.nextUrl.port}` : '';

  const destino = env.ROOT_DOMAIN
    ? `${request.nextUrl.protocol}//app.${env.ROOT_DOMAIN}${porta}/master`
    : `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}/auth/entrar`;

  const resposta = NextResponse.redirect(destino);
  resposta.cookies.delete(nomeDoCookieDeSessao(seguro));

  return resposta;
}
