import { NextResponse, type NextRequest } from 'next/server';

import { masterHost } from '@/server/tenant/resolve';
import { nomeDoCookieDeSessao } from '@/server/support/handoff';

/** Encerra o acesso de suporte e devolve o master para a casa dele. */
export async function GET(request: NextRequest) {
  const seguro = request.nextUrl.protocol === 'https:';
  const porta = request.nextUrl.port ? `:${request.nextUrl.port}` : '';

  const casa = masterHost();
  const destino = casa
    ? `${request.nextUrl.protocol}//${casa}${porta}/master`
    : `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}/auth/entrar`;

  const resposta = NextResponse.redirect(destino);
  resposta.cookies.delete(nomeDoCookieDeSessao(seguro));

  return resposta;
}
