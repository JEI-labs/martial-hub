import { type User } from 'next-auth';
import { ZodError } from 'zod';

import { loginSchema } from '@/server/validations/auth';
import { prisma } from '../db';
import { verify } from 'argon2';
import lodash from 'lodash';

export async function authorize(
  credentials: Record<'username' | 'password', string> | undefined,
): Promise<User | null> {
  let creds;
  try {
    creds = await loginSchema.parseAsync(credentials);
  } catch (error) {
    // entrada malformada é falha de credencial, não de infraestrutura
    if (error instanceof ZodError) return null;
    throw error;
  }

  // Sem try/catch em volta do resto de propósito: antes, banco fora do ar e
  // senha errada caíam no mesmo `return null`, e os dois viravam um 401 mudo.
  // Agora falha de infraestrutura sobe como erro de verdade — aparece nos logs
  // da Vercel e a tela mostra "erro inesperado" em vez de acusar a senha.
  const user = await prisma.user.findFirst({
    where: { email: creds.username.toLowerCase() },
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
