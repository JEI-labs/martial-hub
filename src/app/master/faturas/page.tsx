'use client';

import { InvoicesPanel } from '@/components/master/invoicesPanel.component';

export default function MasterFaturas() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Faturas</h1>
        <p className="text-muted-foreground text-sm">
          O que cada academia deve, e o que já pagou.
        </p>
      </div>

      <InvoicesPanel />
    </div>
  );
}
