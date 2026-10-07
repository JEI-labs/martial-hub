import { format } from 'date-fns';

/**
 * Momento de um pagamento: com a hora quando ela existe.
 *
 * Mensalidade registrada pelo sistema guarda o instante do clique, e é isso
 * que a academia quer ver ("recebi às 19:40, depois do treino"). Já um
 * lançamento digitado à mão só tem o dia e cai à meia-noite — mostrar "00:00"
 * nele seria inventar uma precisão que ninguém informou.
 */
export const formatPaymentMoment = (
  value: Date | string | null | undefined,
  fallback = '—',
): string => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  const hasTime =
    date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;

  return format(date, hasTime ? "dd/MM/yyyy 'às' HH:mm" : 'dd/MM/yyyy');
};
