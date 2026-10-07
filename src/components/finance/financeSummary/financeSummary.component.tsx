import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  GraduationCap,
  Wallet,
} from 'lucide-react';

import { KpiCard } from '@/components/kpiCard/kpiCard.component';
import { IFinancialSummary } from './financeSummary.types';
import { maskBRL } from '@/utils/masksUtils';

/**
 * Os quatro números do período. Usa o mesmo cartão do painel: antes eram
 * caixas próprias com o valor colorido de verde ou vermelho, o que pintava a
 * tela inteira e ainda dizia a cor errada — receita não é "boa" nem despesa
 * "ruim", elas só existem. Cor fica só onde tem julgamento: o saldo.
 */
export const FinancialSummary: React.FC<IFinancialSummary> = (
  data: IFinancialSummary,
) => {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Receitas pagas"
        value={maskBRL(data.incomes, true)}
        icon={ArrowUpRight}
        hint="entradas do período"
      />

      <KpiCard
        label="Despesas pagas"
        value={maskBRL(data.expenses, true)}
        icon={ArrowDownRight}
        hint="saídas do período"
      />

      <KpiCard
        label="Receitas de alunos"
        value={maskBRL(data.studentIncomes || 0, true)}
        icon={GraduationCap}
        hint="mensalidades quitadas"
      />

      <KpiCard
        label="Saldo"
        value={maskBRL(data.net, true)}
        icon={Wallet}
        hint={`${maskBRL(data.incomes, true)} − ${maskBRL(data.expenses, true)}`}
        tone={data.net >= 0 ? 'positive' : 'negative'}
      />
    </div>
  );
};
