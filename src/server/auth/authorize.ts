import { type User } from 'next-auth';
import { ZodError } from 'zod';

import { loginSchema } from '@/server/validations/auth';
import { prisma } from '../db';
import { verify } from 'argon2';
import lodash from 'lodash';
import { ETenantStatus, EUserRole, type Prisma } from '@prisma/client';
import { getTenantByHost } from '@/server/tenant/resolve';

type RequisicaoDeLogin = {
  headers?: Record<string, string | undefined> | undefined;
};

export async function authorize(
  credentials: Record<'username' | 'password', string> | undefined,
  req?: RequisicaoDeLogin,
): Promise<User | null> {
  let creds;
  try {
    creds = await loginSchema.parseAsync(credentials);
  } catch (error) {
    // entrada malformada é falha de credencial, não de infraestrutura
    if (error instanceof ZodError) return null;
    throw error;
  }

  const email = creds.username.toLowerCase();

  /* Quem entra depende de por onde entrou: o endereço diz qual academia é a
     casa, e só gente dessa casa passa. Sem isso, o dono de uma academia
     entraria pelo domínio da outra com o próprio login. */
  const tenant = await getTenantByHost(req?.headers?.host ?? null);

  if (tenant && tenant.status !== ETenantStatus.ACTIVE) {
    if (tenant.status === ETenantStatus.TRIAL) {
      // período de teste segue valendo
    } else {
      throw new Error('Esta academia está sem acesso ao sistema no momento.');
    }
  }

  const where: Prisma.UserWhereInput = tenant
    ? { email, tenantId: tenant.id }
    : /* Endereço que não é de academia nenhuma — `app.seusistema.com.br` — é a
         porta do dono do sistema. Em desenvolvimento não há domínio para
         resolver, então qualquer conta entra pelo localhost. */
      process.env.NODE_ENV === 'development'
      ? { email }
      : { email, role: EUserRole.MASTER };

  // Sem try/catch em volta do resto de propósito: antes, banco fora do ar e
  // senha errada caíam no mesmo `return null`, e os dois viravam um 401 mudo.
  // Agora falha de infraestrutura sobe como erro de verdade — aparece nos logs
  // da Vercel e a tela mostra "erro inesperado" em vez de acusar a senha.
  const user = await prisma.user.findFirst({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      tenantId: true,
      role: true,
    },
  });

  if (!user) return null;

  const isValidPassword = await verify(user.password, creds.password);
  if (!isValidPassword) return null;

  return lodash.omit(user, ['password']) as User;
}
