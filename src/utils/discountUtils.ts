import { EDiscountType } from '@prisma/client';

/**
 * Desconto de uma parcela. Percentual é sobre o valor cheio; fixo nunca passa
 * do valor da parcela, senão o recebido ficaria negativo.
 *
 * Fica fora do router porque a tela precisa mostrar o valor final antes de
 * confirmar, e a conta tem que ser a mesma dos dois lados.
 */
export function calculateDiscount(
  amount: number,
  discountType: EDiscountType,
  discountValue: number,
): number {
  const raw =
    discountType === EDiscountType.PERCENTAGE
      ? (amount * discountValue) / 100
      : discountValue;

  return Math.min(Math.max(raw, 0), amount);
}
