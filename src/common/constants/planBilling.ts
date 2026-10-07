import { EPlanBilling } from '@prisma/client';

/** Como o plano é cobrado, com o texto que aparece nas telas. */
export const PLAN_BILLING_OPTIONS = [
  {
    value: EPlanBilling.MONTHLY,
    textValue: 'Mensal — uma parcela por mês',
  },
  {
    value: EPlanBilling.UPFRONT,
    textValue: 'À vista — o período inteiro na matrícula',
  },
];

export const PLAN_BILLING_LABEL: Record<EPlanBilling, string> = {
  [EPlanBilling.MONTHLY]: 'Mensal',
  [EPlanBilling.UPFRONT]: 'À vista',
};
