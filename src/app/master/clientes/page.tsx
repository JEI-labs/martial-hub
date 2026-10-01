'use client';

import { TenantsTable } from '@/components/master/tenantsTable.component';

export default function MasterClientes() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <p className="text-muted-foreground text-sm">
          Cada academia com o seu endereço, a sua assinatura e o que está em
          aberto.
        </p>
      </div>

      <TenantsTable />
    </div>
  );
}
