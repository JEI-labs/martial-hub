'use client';

import * as React from 'react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { GRADUATIONS } from '@/common/constants/graduations';
import type { RouterOutputs } from '@/trpc/react';
import type { EGraduation } from '@prisma/client';

type Overview = RouterOutputs['dashboard']['getOverview'];
type Series = Overview['series'];
type Breakdowns = Overview['breakdowns'];

/** Eixos ficam ilegíveis com o valor cheio; o tooltip mostra o exato. */
const compactBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const fullBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const money = (value: number) => fullBRL.format(value);

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Crédito',
  DEBIT_CARD: 'Débito',
  TRANSFER: 'Transferência',
  PIX: 'Pix',
  BOLETO: 'Boleto',
  NAO_INFORMADO: 'Não informado',
};

const STATUS_COLOR: Record<string, string> = {
  'EM DIA': 'hsl(142 71% 45%)',
  'PENDENTE': 'hsl(38 92% 50%)',
  'ATRASADO': 'hsl(0 72% 51%)',
  'SEM MATRÍCULA': 'hsl(240 5% 65%)',
};

function ChartCard({
  title,
  description,
  headerRight,
  children,
}: {
  title: string;
  description?: string;
  /** Número que resume o gráfico, alinhado ao título. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {headerRight}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Nada de gráfico vazio contando mentira: sem dado, o card diz isso. */
function NoData({ text = 'Sem dados no período.' }: { text?: string }) {
  return (
    <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
      {text}
    </div>
  );
}

/**
 * A série vem em dias quando o período escolhido é curto e em meses quando é
 * longo — a chave do ponto ('2026-09' ou '2026-09-25') diz qual é.
 */
function scaleWord(series: Series): 'dia' | 'mês' {
  return (series[0]?.month.length ?? 7) > 7 ? 'dia' : 'mês';
}

export function MrrChart({ series }: { series: Series }) {
  const config = {
    mrr: { label: 'MRR', color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig;

  return (
    <ChartCard
      title="Receita recorrente (MRR)"
      description={`Soma das mensalidades vigentes ao fim de cada ${scaleWord(series)}`}
    >
      <ChartContainer config={config} className="h-[220px] w-full">
        <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={62}
            tickFormatter={(value: number) => compactBRL.format(value)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => money(Number(value))}
              />
            }
          />
          <Area
            isAnimationActive={false}
            dataKey="mrr"
            type="linear"
            stroke="var(--color-mrr)"
            fill="var(--color-mrr)"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function CashflowChart({ series }: { series: Series }) {
  const config = {
    income: { label: 'Entradas', color: 'hsl(142 71% 45%)' },
    outflow: { label: 'Saídas', color: 'hsl(0 72% 51%)' },
  } satisfies ChartConfig;

  /* Saída entra negativa: entrada sobe, despesa desce e o saldo do mês é a
     diferença entre as duas metades. A linha de resultado que existia aqui
     cruzava as barras e, com poucos meses lançados, virava um triângulo
     tomando o gráfico inteiro. */
  const data = series.map((month) => ({
    ...month,
    outflow: -month.expense,
  }));

  const net = series.reduce((total, month) => total + month.net, 0);
  const isEmpty = series.every(
    (month) => month.income === 0 && month.expense === 0,
  );

  return (
    <ChartCard
      title="Receitas × despesas"
      description="Entradas acima da linha, saídas abaixo — lançamentos pagos"
      headerRight={
        isEmpty ? null : (
          <div className="text-right">
            <span className="text-muted-foreground block text-xs">
              resultado do período
            </span>
            <span
              className={
                net >= 0
                  ? 'text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                  : 'text-sm font-semibold text-rose-600 dark:text-rose-400'
              }
            >
              {money(net)}
            </span>
          </div>
        )
      }
    >
      {isEmpty ? (
        <NoData text="Nenhum lançamento pago no período." />
      ) : (
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart
            data={data}
            stackOffset="sign"
            margin={{ left: 4, right: 8, top: 8 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={16}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={62}
              tickFormatter={(value: number) =>
                compactBRL.format(Math.abs(value))
              }
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => money(Math.abs(Number(value)))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              isAnimationActive={false}
              dataKey="income"
              stackId="cash"
              fill="var(--color-income)"
              maxBarSize={44}
              radius={[8, 8, 0, 0]}
            />
            <Bar
              isAnimationActive={false}
              dataKey="outflow"
              stackId="cash"
              fill="var(--color-outflow)"
              maxBarSize={44}
              radius={[0, 0, 8, 8]}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

export function StudentsFlowChart({ series }: { series: Series }) {
  const config = {
    newStudents: { label: 'Entradas', color: 'hsl(var(--chart-2))' },
    churned: { label: 'Matrículas encerradas', color: 'hsl(var(--chart-5))' },
  } satisfies ChartConfig;

  return (
    <ChartCard
      title="Entradas × saídas"
      description={`Alunos cadastrados e matrículas encerradas por ${scaleWord(series)}`}
    >
      <ChartContainer config={config} className="h-[220px] w-full">
        <BarChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={32}
            allowDecimals={false}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            isAnimationActive={false}
            dataKey="newStudents"
            fill="var(--color-newStudents)"
            maxBarSize={44}
            radius={[8, 8, 0, 0]}
          />
          <Bar
            isAnimationActive={false}
            dataKey="churned"
            fill="var(--color-churned)"
            maxBarSize={44}
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

export function StatusChart({
  byStatus,
}: {
  byStatus: Breakdowns['byStatus'];
}) {
  const data = byStatus.filter((item) => item.students > 0);
  const config = Object.fromEntries(
    byStatus.map((item) => [
      item.status,
      { label: item.status, color: STATUS_COLOR[item.status] },
    ]),
  ) satisfies ChartConfig;

  return (
    <ChartCard
      title="Situação das matrículas"
      description="Mesma regra da lista de alunos"
    >
      {data.length === 0 ? (
        <NoData text="Nenhum aluno matriculado." />
      ) : (
        <ChartContainer config={config} className="h-[220px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="status" />} />
            <Pie
              isAnimationActive={false}
              data={data}
              dataKey="students"
              nameKey="status"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {data.map((item) => (
                <Cell
                  key={item.status}
                  fill={STATUS_COLOR[item.status]}
                  stroke="transparent"
                />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="status" />} />
          </PieChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

export function PlanChart({ byPlan }: { byPlan: Breakdowns['byPlan'] }) {
  const config = {
    mrr: { label: 'MRR', color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig;

  return (
    <ChartCard
      title="MRR por plano"
      description="Quanto cada plano responde da receita recorrente"
    >
      {byPlan.length === 0 ? (
        <NoData text="Nenhuma matrícula vigente." />
      ) : (
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart
            data={byPlan}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => compactBRL.format(value)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={96}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const students = (item?.payload as { students?: number })
                      ?.students;
                    return `${money(Number(value))} · ${students ?? 0} aluno(s)`;
                  }}
                />
              }
            />
            <Bar
              isAnimationActive={false}
              dataKey="mrr"
              fill="var(--color-mrr)"
              maxBarSize={44}
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

export function AgingChart({ aging }: { aging: Breakdowns['aging'] }) {
  const config = {
    amount: { label: 'Em aberto', color: 'hsl(0 72% 51%)' },
  } satisfies ChartConfig;

  const total = aging.reduce((sum, bucket) => sum + bucket.amount, 0);

  return (
    <ChartCard
      title="Inadimplência por tempo de atraso"
      description="Parcelas vencidas e ainda não pagas"
    >
      {total === 0 ? (
        <NoData text="Nenhuma parcela vencida. " />
      ) : (
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart data={aging} margin={{ left: 4, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={62}
              tickFormatter={(value: number) => compactBRL.format(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const count = (item?.payload as { count?: number })?.count;
                    return `${money(Number(value))} · ${count ?? 0} parcela(s)`;
                  }}
                />
              }
            />
            <Bar
              isAnimationActive={false}
              dataKey="amount"
              fill="var(--color-amount)"
              maxBarSize={44}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

export function ExpensesByCategoryChart({
  expenses,
}: {
  expenses: Breakdowns['expensesByCategory'];
}) {
  const config = {
    amount: { label: 'Despesas', color: 'hsl(var(--chart-5))' },
  } satisfies ChartConfig;

  const data = expenses.slice(0, 8);

  return (
    <ChartCard
      title="Despesas por categoria"
      description="Lançamentos pagos no período escolhido"
    >
      {data.length === 0 ? (
        <NoData text="Nenhuma despesa paga neste período." />
      ) : (
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => compactBRL.format(value)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => money(Number(value))}
                />
              }
            />
            <Bar
              isAnimationActive={false}
              dataKey="amount"
              fill="var(--color-amount)"
              maxBarSize={44}
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

export function GraduationChart({
  byGraduation,
}: {
  byGraduation: Breakdowns['byGraduation'];
}) {
  const config = {
    students: { label: 'Alunos', color: 'hsl(var(--chart-3))' },
  } satisfies ChartConfig;

  const data = byGraduation.map((item) => {
    const isNone = item.graduation === 'SEM_GRADUACAO';
    const info = isNone ? null : GRADUATIONS[item.graduation as EGraduation];

    return {
      ...item,
      key: String(item.graduation),
      label: isNone ? 'Sem graduação' : `${info?.degree}º`,
      full: isNone ? 'Sem graduação' : (info?.label ?? ''),
      colors: info?.colors ?? [],
    };
  });

  /* A barra ganha as faixas da fita, empilhadas como no badge: o gradiente
     com paradas duras desenha listras em vez de degradê. */
  const gradientId = (key: string) => `graduacao-${key}`;

  return (
    <ChartCard
      title="Alunos por graduação"
      description="Cada barra usa as cores da fita do grau"
    >
      {data.length === 0 ? (
        <NoData text="Nenhum aluno cadastrado." />
      ) : (
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
            <defs>
              {data.map((item) => (
                <linearGradient
                  key={item.key}
                  id={gradientId(item.key)}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  {item.colors.length > 0 ? (
                    item.colors.map((color, index) => (
                      <React.Fragment key={`${item.key}-${color}-${index}`}>
                        <stop
                          offset={`${(index / item.colors.length) * 100}%`}
                          stopColor={color}
                        />
                        <stop
                          offset={`${((index + 1) / item.colors.length) * 100}%`}
                          stopColor={color}
                        />
                      </React.Fragment>
                    ))
                  ) : (
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--muted-foreground))"
                    />
                  )}
                </linearGradient>
              ))}
            </defs>

            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_label, payload) =>
                    (payload?.[0]?.payload as { full?: string })?.full ?? ''
                  }
                />
              }
            />
            <Bar
              isAnimationActive={false}
              dataKey="students"
              maxBarSize={44}
              radius={[8, 8, 0, 0]}
            >
              {data.map((item) => (
                <Cell
                  key={item.key}
                  fill={`url(#${gradientId(item.key)})`}
                  /* contorno para a faixa branca não sumir no tema claro */
                  stroke="hsl(var(--border))"
                  strokeWidth={1}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

export function PaymentMethodChart({
  incomeByMethod,
}: {
  incomeByMethod: Breakdowns['incomeByMethod'];
}) {
  const config = {
    amount: { label: 'Recebido', color: 'hsl(var(--chart-4))' },
  } satisfies ChartConfig;

  const data = incomeByMethod.map((item) => ({
    ...item,
    label: PAYMENT_METHOD_LABEL[item.method] ?? item.method,
  }));

  return (
    <ChartCard
      title="Recebimentos por forma de pagamento"
      description="Entradas pagas no período escolhido"
    >
      {data.length === 0 ? (
        <NoData text="Nenhuma entrada paga neste período." />
      ) : (
        <ChartContainer config={config} className="h-[220px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 16 }}
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) => compactBRL.format(value)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tickLine={false}
              axisLine={false}
              width={110}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => money(Number(value))}
                />
              }
            />
            <Bar
              isAnimationActive={false}
              dataKey="amount"
              fill="var(--color-amount)"
              maxBarSize={44}
              radius={[0, 8, 8, 0]}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}
