/**
 * Quanto custa uma matrícula.
 *
 * Fica num lugar só, usado pelo servidor (que cobra) e pelas telas (que
 * mostram a prévia antes de confirmar): duas contas iguais escritas em dois
 * lugares divergem, e a prévia passaria a mentir.
 */

import { monthlyValue } from '@/utils/planUtils';

/** O valor de um plano numa modalidade, quando ele tem um próprio. */
export interface ModalityPrice {
  modalityId: string;
  price: number;
}

/** O que a conta precisa de um plano. */
export interface PricedPlan {
  price: number;
  modalityPrices?: Array<ModalityPrice>;
}

/**
 * O preço cheio do plano nesta modalidade: o valor próprio dela, ou o preço
 * padrão do plano quando ela não tem um.
 */
export function precoNaModalidade(plan: PricedPlan, modalityId: string) {
  const proprio = plan.modalityPrices?.find(
    (item) => item.modalityId === modalityId,
  );
  return proprio ? Number(proprio.price) : Number(plan.price);
}

/** Aplica o desconto, arredondando para o centavo. */
export function comDesconto(preco: number, percent: number) {
  if (!percent) return preco;
  return Math.round(preco * (100 - percent)) / 100;
}

/** O que a conta do desconto precisa de uma matrícula que já existe. */
export interface MatriculaExistente {
  discountPercent: number;
  endDate: Date | string;
  isActive?: boolean;
}

/**
 * As matrículas que contam como "o aluno já faz outra modalidade": ativas e
 * dentro do prazo. Uma trimestral que terminou em agosto e nunca foi
 * renovada continua com `isActive`, mas não é contrato em vigor — e não
 * pode dar desconto de 2ª modalidade a ninguém.
 */
export function vigentes<T extends MatriculaExistente>(
  matriculas: Array<T>,
  agora: Date = new Date(),
): Array<T> {
  return matriculas.filter(
    (m) => m.isActive !== false && new Date(m.endDate) >= agora,
  );
}

/**
 * O desconto de cada matrícula nova de um aluno — ou da que substitui outra,
 * na troca de plano.
 *
 * A regra da academia é desconto da 2ª modalidade em diante, e quer dizer:
 * sempre há uma modalidade pagando cheio. Então:
 * - se entre as outras matrículas vigentes do aluno alguma paga cheio, as
 *   novas ganham desconto;
 * - se não (aluno novo, ou a que pagava cheio foi cancelada ou é a que está
 *   sendo trocada), paga cheio a nova mais cara e as outras ganham desconto.
 *
 * "Mais cara" é pelo valor mensal, não pelo do período: o anual de R$ 1.200
 * (R$ 100/mês) custa menos que o mensal de R$ 150, e o desconto vai para o
 * que custa menos.
 *
 * É a mesma função no servidor (que cobra) e na prévia das telas.
 *
 * @param novas o preço cheio e a duração de cada matrícula nova, na ordem
 * @param outras as outras matrículas vigentes do aluno (`vigentes`); na
 *   troca de plano, sem a que está sendo trocada
 * @param percent o desconto da academia, em %
 * @returns o desconto de cada nova, na mesma ordem
 */
export function descontosDasMatriculas(
  novas: Array<{ preco: number; duracao: number }>,
  outras: Array<Pick<MatriculaExistente, 'discountPercent'>>,
  percent: number,
): Array<number> {
  if (!percent || novas.length === 0) return novas.map(() => 0);
  if (outras.some((m) => m.discountPercent === 0)) {
    return novas.map(() => percent);
  }

  const mensais = novas.map((n) => monthlyValue(n.preco, n.duracao));
  const maisCara = mensais.indexOf(Math.max(...mensais));
  return novas.map((_, index) => (index === maisCara ? 0 : percent));
}
