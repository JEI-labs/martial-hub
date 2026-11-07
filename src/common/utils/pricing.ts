/**
 * Quanto custa uma matrícula.
 *
 * Fica num lugar só, usado pelo servidor (que cobra) e pelas telas (que
 * mostram a prévia antes de confirmar): duas contas iguais escritas em dois
 * lugares divergem, e a prévia passaria a mentir.
 */

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

/**
 * O desconto de cada matrícula nova de um aluno.
 *
 * A regra da academia é desconto da 2ª modalidade em diante. Quem já tem
 * matrícula ativa ganha desconto em todas as novas. Quem não tem nenhuma e
 * entra em várias de uma vez paga cheio na mais cara e ganha desconto nas
 * outras — o desconto vai para o que custa menos, não o contrário.
 *
 * @param precosCheios o preço cheio de cada matrícula nova, na ordem pedida
 * @param jaAtivas quantas matrículas ativas o aluno já tem
 * @param percent o desconto da academia, em %
 * @returns o desconto de cada uma, na mesma ordem
 */
export function descontosDasMatriculas(
  precosCheios: Array<number>,
  jaAtivas: number,
  percent: number,
): Array<number> {
  if (!percent) return precosCheios.map(() => 0);
  if (jaAtivas > 0) return precosCheios.map(() => percent);

  const maisCara = precosCheios.indexOf(Math.max(...precosCheios));
  return precosCheios.map((_, index) => (index === maisCara ? 0 : percent));
}
