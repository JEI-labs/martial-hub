'use client';

import {
  AlertTriangle,
  Building2,
  CircleDollarSign,
  Repeat,
  TrendingUp,
  Users,
} from 'lucide-react';

import { KpiCard } from '@/components/kpiCard/kpiCard.component';
import { StatsSkeleton } from '@/components/skeletons/listSkeleton.component';
import { TenantsTable } from '@/components/master/tenantsTable.component';
import { api } from '@/trpc/react';
import { maskBRL } from '@/utils/masksUtils';

export default function MasterPainel() {
  const { data, isLoading } = api.master.overview.useQuery();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel</h1>
        <p className="text-muted-foreground text-sm">
          Como está o sistema como negócio: quem paga, quanto entra e o que está
          em aberto.
        </p>
      </div>

      {isLoading || !data ? (
        <StatsSkeleton cards={6} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <KpiCard
            label="MRR"
            value={maskBRL(data.mrr, true)}
            icon={Repeat}
            hint={`${data.assinaturas} assinatura(s) valendo`}
          />
          <KpiCard
            label="ARR"
            value={maskBRL(data.arr, true)}
            icon={TrendingUp}
            hint="MRR × 12"
          />
          <KpiCard
            label="Clientes ativos"
            value={String(data.clientes.ativos)}
            icon={Building2}
            hint={`${data.clientes.teste} em teste · ${data.clientes.suspensos} suspenso(s)`}
          />
          <KpiCard
            label="Faturas em aberto"
            value={maskBRL(data.faturas.abertas.valor, true)}
            icon={CircleDollarSign}
            hint={`${data.faturas.abertas.quantidade} fatura(s)`}
          />
          <KpiCard
            label="Faturas atrasadas"
            value={maskBRL(data.faturas.atrasadas.valor, true)}
            icon={AlertTriangle}
            hint={`${data.faturas.atrasadas.quantidade} fatura(s)`}
            tone={
              data.faturas.atrasadas.quantidade > 0 ? 'negative' : 'default'
            }
          />
          <KpiCard
            label="Alunos no sistema"
            value={String(data.alunosNoSistema)}
            icon={Users}
            hint="somando todas as academias"
          />
        </section>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Clientes</h2>
        <TenantsTable />
      </div>
    </div>
  );
}
