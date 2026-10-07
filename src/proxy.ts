import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { env } from '@/env';

export const DEFAULT_LOGIN_REDIRECT = '/painel';
export const AUTH_PAGE = '/auth/entrar';

const authRoutes = '/auth/';
const publicRoutes = ['/'];

/* A entrada de suporte chega sem sessão de propósito: quem autoriza é o
   bilhete assinado que ela própria confere. Barrá-la aqui mandaria o master
   para o login da academia, que é justamente onde ele não tem conta. */
const supportRoutes = '/suporte/';

/**
 * Tudo que cair no matcher vai ser executado pelo proxy
 * Rotas excluidas: /api/ /trcp/ /_next/ /public/ /favicon.ico
 */
export const config = {
  matcher: ['/((?!\\bapi\\b|\\btrpc\\b|_next|.*\\..*|favicon.ico).*)'],
};

export async function proxy(request: NextRequest) {
  const { nextUrl } = request;

  const session = await getToken({
    req: request,
    secret: env.NEXTAUTH_SECRET,
  });

  const isLoggedIn = !!session;
  const isPublicRoute = publicRoutes.includes(nextUrl.pathname);
  const isAuthRoute = nextUrl.pathname.startsWith(authRoutes);
  const isSupportRoute = nextUrl.pathname.startsWith(supportRoutes);

  if (isSupportRoute) return;

  // Se for rota publica pode acessar
  if (isPublicRoute)
    return NextResponse.redirect(new URL(DEFAULT_LOGIN_REDIRECT, request.url));

  // Se for rota de autenticação e o usuário não estiver logado, permite acesso
  if (!isLoggedIn && isAuthRoute) return;

  // Se o usuário não estiver logado, redirecionar pra página de login
  if (!isLoggedIn)
    return NextResponse.redirect(new URL(AUTH_PAGE, request.url));
}
