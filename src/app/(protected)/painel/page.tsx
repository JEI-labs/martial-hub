'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CircleDollarSign,
  PiggyBank,
  Repeat,
  TrendingUp,
  UserMinus,
  Users,
  Wallet,
} from 'lucide-react';

import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import { StatsSkeleton } from '@/components/skeletons/listSkeleton.component';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AdvancedFilterDatePicker,
  getLastYearRange,
} from '@/components/forms/advancedFilterDatePicker/advancedFilterDatePicker.component';
import { KpiCard } from '@/components/kpiCard/kpiCard.component';
import {
  AgingChart,
  CashflowChart,
  ExpensesByCategoryChart,
  GraduationChart,
  MrrChart,
  PaymentMethodChart,
  PlanChart,
  StatusChart,
  StudentsFlowChart,
} from '@/components/dashboard/dashboardCharts.component';
import {
  BirthdaysList,
  ExpiringEnrollmentsList,
  MessagesCard,
  TopOverdueList,
} from '@/components/dashboard/dashboardLists.component';
import { BillingAlert } from '@/components/tenant/billingAlert.component';
import { api } from '@/trpc/react';
import { useSession } from 'next-auth/react';
import { maskBRL } from '@/utils/masksUtils';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Dashboard', href: '/painel' },
];

const defaultRange = getLastYearRange();

export default function DashboardPage() {
  const { data: session } = useSession();
  const [range, setRange] = useState<{ from?: string; to?: string }>({
    from: defaultRange.from.toISOString(),
    to: defaultRange.to.toISOString(),
  });

  const { data, isLoading } = api.dashboard.getOverview.useQuery(range, {
    staleTime: 60_000,
  });

  /* Com um período curto a série sai em dias, e a comparação do MRR passa a
     ser contra o dia anterior. */
  const scaleWord = (data?.series[0]?.month.length ?? 7) > 7 ? 'dia' : 'mês';

  /** Variação do MRR contra o ponto anterior, tirada da própria série. */
  const mrrTrend = useMemo(() => {
    const series = data?.series ?? [];
    const current = series.at(-1)?.mrr ?? 0;
    const previous = series.at(-2)?.mrr ?? 0;
    if (previous <= 0) return undefined;
    return ((current - previous) / previous) * 100;
  }, [data?.series]);

  const studentsTrend = useMemo(() => {
    if (!data) return undefined;
    const { newStudentsThisMonth, newStudentsPreviousMonth } = data.kpis;
    if (newStudentsPreviousMonth <= 0) return undefined;
    return (
      ((newStudentsThisMonth - newStudentsPreviousMonth) /
        newStudentsPreviousMonth) *
      100
    );
  }, [data]);

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Receita recorrente, alunos e caixa da academia.
            </p>
          </div>

          {/* O mesmo filtro das outras telas, com os atalhos de mês que o
              painel precisa. Vale para os gráficos; os cards de cima são o
              retrato de hoje. */}
          <AdvancedFilterDatePicker
            defaultValue={defaultRange}
            title="Período"
            description="Período dos gráficos"
            numberOfMonths={1}
            showDeleteButton={false}
            rightIcon={<Calendar />}
            onChange={({ from, to }) =>
              setRange({
                from: from ? from.toISOString() : undefined,
                to: to ? to.toISOString() : undefined,
              })
            }
          />
        </div>

        {/* Conta a pagar do próprio sistema: assunto do dono, não da
            recepção. */}
        {session?.user.role === 'OWNER' && <BillingAlert />}

        {isLoading || !data ? (
          <div className="flex flex-col gap-6">
            <StatsSkeleton cards={9} />
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1, 2, 3].map((chart) => (
                <div
                  key={chart}
                  className="bg-card shadow-card flex flex-col gap-4 rounded-2xl p-5"
                >
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                  <Skeleton className="h-[220px] w-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                label="MRR"
                value={maskBRL(data.kpis.mrr, true)}
                icon={Repeat}
                hint="mensalidades vigentes"
                trend={
                  mrrTrend === undefined
                    ? undefined
                    : { value: mrrTrend, label: `vs. ${scaleWord} anterior` }
                }
              />
              <KpiCard
                label="ARR"
                value={maskBRL(data.kpis.arr, true)}
                icon={TrendingUp}
                hint="MRR × 12"
              />
              <KpiCard
                label="Ticket médio"
                value={maskBRL(data.kpis.arpu, true)}
                icon={CircleDollarSign}
                hint="MRR por aluno ativo"
              />
              <KpiCard
                label="Alunos ativos"
                value={String(data.kpis.activeStudents)}
                icon={Users}
                hint={`${data.kpis.totalStudents} cadastrados · ${data.kpis.newStudentsThisMonth} novos no mês`}
                trend={
                  studentsTrend === undefined
                    ? undefined
                    : { value: studentsTrend, label: 'de novos alunos' }
                }
              />
              <KpiCard
                label="Saídas no mês"
                value={String(data.kpis.churnedThisMonth)}
                icon={UserMinus}
                hint={`churn de ${data.kpis.churnRate.toFixed(1)}%`}
                tone={data.kpis.churnedThisMonth > 0 ? 'negative' : 'default'}
              />
              <KpiCard
                label="Recebido no mês"
                value={maskBRL(data.kpis.receivedThisMonth, true)}
                icon={Wallet}
                hint="parcelas quitadas"
              />
              <KpiCard
                label="Inadimplência"
                value={maskBRL(data.kpis.overdueAmount, true)}
                icon={AlertTriangle}
                hint={`${data.kpis.overdueStudents} aluno(s) com parcela vencida`}
                tone={data.kpis.overdueAmount > 0 ? 'negative' : 'default'}
              />
              <KpiCard
                label="A receber em 30 dias"
                value={maskBRL(data.kpis.upcoming30Days, true)}
                icon={CalendarCheck}
                hint="parcelas a vencer"
              />
              <KpiCard
                label="Resultado do mês"
                value={maskBRL(data.kpis.netThisMonth, true)}
                icon={PiggyBank}
                hint={`${maskBRL(data.kpis.incomeThisMonth, true)} − ${maskBRL(data.kpis.expenseThisMonth, true)}`}
                tone={data.kpis.netThisMonth >= 0 ? 'positive' : 'negative'}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <MrrChart series={data.series} />
              <CashflowChart series={data.series} />
              <StudentsFlowChart series={data.series} />
              <StatusChart byStatus={data.breakdowns.byStatus} />
              <PlanChart byPlan={data.breakdowns.byPlan} />
              <AgingChart aging={data.breakdowns.aging} />
              <ExpensesByCategoryChart
                expenses={data.breakdowns.expensesByCategory}
              />
              <PaymentMethodChart
                incomeByMethod={data.breakdowns.incomeByMethod}
              />
              {/* Ímpar na grade de duas colunas: ocupa a linha inteira em
                  vez de deixar metade vazia. */}
              <div className="lg:col-span-2">
                <GraduationChart byGraduation={data.breakdowns.byGraduation} />
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <TopOverdueList students={data.alerts.topOverdue} />
              <ExpiringEnrollmentsList
                enrollments={data.alerts.expiringEnrollments}
              />
              <BirthdaysList birthdays={data.alerts.birthdays} />
              <MessagesCard messages={data.alerts.messages} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
