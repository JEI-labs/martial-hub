import 'server-only';

import { redirect } from 'next/navigation';
import { EUserRole } from '@prisma/client';

import { getServerAuthSession } from '@/server/auth';

/**
 * Porteiro das seções. O servidor já recusa as ações pelo papel; isto evita a
 * tela abrir e só então reclamar — quem não tem acesso ao Financeiro vai para
 * a lista de alunos, que todo mundo tem.
 */
export async function requireSection(papeis: ReadonlyArray<EUserRole>) {
  const session = await getServerAuthSession();

  if (!session) redirect('/auth/entrar');

  const { role } = session.user;
  if (role !== EUserRole.MASTER && !papeis.includes(role)) {
    redirect('/alunos');
  }

  return session;
}
