import { EUserRole } from '@prisma/client';

import { requireSection } from '@/server/auth/guards';
import { SectionTabs } from '@/components/sectionTabs/sectionTabs.component';

/* LayoutProps é helper global do Next 16, gerado no dev/build — sem import. */
export default async function RegistrationsLayout({
  children,
}: LayoutProps<'/cadastros'>) {
  await requireSection([EUserRole.OWNER]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cadastros</h1>
        <p className="text-muted-foreground text-sm">
          O que o resto do sistema usa como base: planos, categorias, promoções
          e fornecedores.
        </p>
      </div>

      <SectionTabs section="registrations" />

      {children}
    </div>
  );
}
