import { EUserRole } from '@prisma/client';

import { requireSection } from '@/server/auth/guards';
import { SectionTabs } from '@/components/sectionTabs/sectionTabs.component';

/* LayoutProps é helper global do Next 16, gerado no dev/build — sem import. */
export default async function FinancialLayout({
  children,
}: LayoutProps<'/financeiro'>) {
  await requireSection([EUserRole.OWNER, EUserRole.STAFF]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          O dinheiro da academia: o que entrou, o que saiu e o que sobrou.
        </p>
      </div>

      <SectionTabs section="financial" />

      {children}
    </div>
  );
}
