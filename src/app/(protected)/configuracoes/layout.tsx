import { EUserRole } from '@prisma/client';

import { requireSection } from '@/server/auth/guards';

/** Marca e equipe são decisões do dono. */
export default async function ConfiguracoesLayout({
  children,
}: LayoutProps<'/configuracoes'>) {
  await requireSection([EUserRole.OWNER]);

  return children;
}
