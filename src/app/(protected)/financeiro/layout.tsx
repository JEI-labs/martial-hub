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
      <SectionTabs section="financial" />

      {children}
    </div>
  );
}
