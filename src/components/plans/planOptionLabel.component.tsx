import { PLAN_BILLING_LABEL } from '@/common/constants/planBilling';
import { maskBRL } from '@/utils/masksUtils';

/** O que é preciso de um plano para descrevê-lo numa opção de select. */
export interface PlanOption {
  name: string;
  price: number | string | { toString(): string };
  duration: number;
  billing: keyof typeof PLAN_BILLING_LABEL;
}

/**
 * Um plano numa linha: "Mensal · R$ 150,00 · 1 mês · Mensal". É o mesmo
 * texto no cadastro do aluno e na troca de plano — duas cópias saíam de
 * sincronia na primeira mudança.
 */
export function PlanOptionLabel({ plan }: { plan: PlanOption }) {
  return (
    <>
      {plan.name} · {maskBRL(Number(plan.price), true)} · {plan.duration}{' '}
      {plan.duration === 1 ? 'mês' : 'meses'} ·{' '}
      {PLAN_BILLING_LABEL[plan.billing]}
    </>
  );
}
