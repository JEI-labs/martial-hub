import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/server/db';
import { getTenantByHost } from '@/server/tenant/resolve';
import {
  criarSessaoDeSuporte,
  lerBilheteDeSuporte,
  nomeDoCookieDeSessao,
} from '@/server/support/handoff';
import { EUserRole } from '@prisma/client';

/**
 * Onde o master chega quando entra como suporte.
 *
 * Roda no endereço da academia, que é o único lugar onde dá para gravar o
 * cookie de sessão dela. O bilhete vale por um minuto e diz para qual
 * academia é — um bilhete da academia A aberto no endereço da B não serve.
 */
export async function GET(request: NextRequest) {
  const bilhete = request.nextUrl.searchParams.get('token');

  /* O destino é montado a partir do cabeçalho Host, não de `request.url`: em
     desenvolvimento o Next normaliza a URL para localhost, e mandar o master
     para lá o jogaria num endereço onde o cookie que acabamos de gravar não
     vale. */
  const base = `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`;
  const paraLogin = NextResponse.redirect(`${base}/auth/entrar`);

  if (!bilhete) return paraLogin;

  const conteudo = await lerBilheteDeSuporte(bilhete);
  if (!conteudo) return paraLogin;

  const tenant = await getTenantByHost(request.headers.get('host'));
  if (!tenant || tenant.id !== conteudo.tenantId) return paraLogin;

  const master = await prisma.user.findFirst({
    where: { id: conteudo.sub, role: EUserRole.MASTER },
    select: { id: true, name: true, email: true },
  });

  if (!master) return paraLogin;

  await prisma.supportAccess.create({
    data: { tenantId: tenant.id, userId: master.id },
  });

  const sessao = await criarSessaoDeSuporte({ ...master, tenantId: tenant.id });
  const seguro = request.nextUrl.protocol === 'https:';

  const resposta = NextResponse.redirect(`${base}/painel`);
  resposta.cookies.set(nomeDoCookieDeSessao(seguro), sessao, {
    httpOnly: true,
    sameSite: 'lax',
    secure: seguro,
    path: '/',
    maxAge: 24 * 60 * 60,
  });

  return resposta;
}
