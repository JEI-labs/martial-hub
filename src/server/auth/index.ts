import { PrismaAdapter } from '@auth/prisma-adapter';
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from 'next-auth';
import { type Adapter } from 'next-auth/adapters';

import { prisma } from '@/server/db';
import type { EUserRole } from '@prisma/client';
import Credentials from 'next-auth/providers/credentials';
import { authorize } from './authorize';

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      name: string;
      email: string;
      /** Academia a que a conta pertence. Nulo só para o dono do sistema. */
      tenantId: string | null;
      role: EUserRole;
      /** Academia que o master está visitando para dar suporte. */
      supportTenantId?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    name: string;
    email: string;
    tenantId: string | null;
    role: EUserRole;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 1 * 24 * 30 * 60, // 1 days
  },
  pages: {
    signIn: '/auth/entrar',
    // newUser: "/auth/register",
  },
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      // if (trigger === "update" && session?.companyId) {
      //   token.companyId = session.companyId;
      // }
      return token;
    },
    session: ({ session, token }) => {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.tenantId = (token.tenantId as string | null) ?? null;
        session.user.role = token.role as EUserRole;
        session.user.supportTenantId =
          (token.supportTenantId as string | null) ?? null;
      }
      return session;
    },
  },
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuário', type: 'username' },
        password: { label: 'Senha', type: 'password' },
        /* Segunda etapa: vazio na primeira tentativa, preenchido quando a
           tela volta pedindo o código. */
        totp: { label: 'Código', type: 'text' },
      },
      authorize,
    }),
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);
