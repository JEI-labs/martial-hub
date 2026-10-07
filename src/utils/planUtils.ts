import { EPlanBilling } from '@prisma/client';

/**
 * `Plan.price` é o valor fechado do período, não o da parcela: um trimestral
 * de R$ 350,50 custa isso pelos três meses.
 *
 * Quantas parcelas o plano gera. À vista é sempre uma, com o período inteiro
 * dentro dela.
 */
export function installmentCount(
  duration: number,
  billing: EPlanBilling,
): number {
  return billing === EPlanBilling.UPFRONT ? 1 : Math.max(duration, 1);
}

/**
 * Divide o preço do período em parcelas, em centavos.
 *
 * A divisão é feita em centavos e o resto vai para as primeiras parcelas:
 * R$ 350,50 em três dá 116,84 + 116,83 + 116,83, que soma exatamente o preço.
 * Dividir em reais e arredondar cada parcela deixaria a academia recebendo um
 * centavo a mais ou a menos do que foi combinado.
 */
export function splitIntoInstallments(
  price: number,
  count: number,
): Array<number> {
  const totalCents = Math.round(price * 100);
  const parts = Math.max(count, 1);
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents - base * parts;

  return Array.from({ length: parts }).map(
    (_, index) => base + (index < remainder ? 1 : 0),
  );
}

/**
 * Valor mensal equivalente, que é o que o MRR mede. Um trimestral de
 * R$ 350,50 pago à vista continua valendo R$ 116,83 por mês de receita
 * recorrente — a forma de cobrar não muda o tamanho do contrato.
 */
export function monthlyValue(price: number, duration: number): number {
  return price / Math.max(duration, 1);
}
