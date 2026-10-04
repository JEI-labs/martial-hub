'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
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
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            label="Vencem em 7 dias"
            value={maskBRL(data.vencendo.valor, true)}
            icon={CalendarClock}
            hint={`${data.vencendo.quantidade} fatura(s) a vencer`}
          />
          <KpiCard
            label="Alunos no sistema"
            value={String(data.alunosNoSistema)}
            icon={Users}
            hint="somando todas as academias"
          />
        </section>
      )}

      {/* Quem vence antes, com nome: a pergunta depois de "3 vencem esta
          semana" é sempre "de quem?". */}
      {data && data.vencendo.lista.length > 0 && (
        <section className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-2">
            <CalendarClock className="text-muted-foreground size-4" />
            <h2 className="font-semibold">Vencendo nos próximos dias</h2>
          </div>

          <div className="flex flex-col gap-2">
            {data.vencendo.lista.map((fatura) => {
              const dias = Math.round(
                (new Date(fatura.dueDate).setHours(0, 0, 0, 0) -
                  new Date().setHours(0, 0, 0, 0)) /
                  86400000,
              );

              return (
                <Link
                  key={fatura.id}
                  href={`/master/clientes/${fatura.tenantId}`}
                  className="bg-muted/60 hover:bg-muted flex flex-wrap items-center gap-3 rounded-xl p-3 transition-colors"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {fatura.tenant}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {dias <= 0
                      ? 'vence hoje'
                      : `em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                    {' · '}
                    {new Date(fatura.dueDate).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {maskBRL(fatura.valor, true)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Clientes</h2>
        <TenantsTable />
      </div>
    </div>
  );
}
