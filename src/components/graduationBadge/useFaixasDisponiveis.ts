'use client';

import { api } from '@/trpc/react';

/**
 * As faixas que dá para dar a um aluno agora, por modalidade: as das
 * modalidades ativas que têm faixa (`graduations.list`).
 *
 * Cada faixa já vem com a modalidade dela (nome e slug), que é o que o badge
 * precisa para dizer "4º grau" no Muay Thai e só o nome no Jiu-Jitsu. O
 * cartão de graduação e o cadastro de aluno usam o mesmo hook para não
 * repetirem o filtro e a regra de "várias modalidades".
 *
 * `isLoading` e `isError` vêm junto de propósito: lista vazia quer dizer "a
 * academia não tem faixa para dar", e não pode ser confundida com "ainda
 * não chegou" nem com "a consulta falhou".
 */
export function useFaixasDisponiveis() {
  const query = api.graduations.list.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const modalidades = (query.data ?? []).map((modalidade) => ({
    ...modalidade,
    graduations: modalidade.graduations.map((faixa) => ({
      ...faixa,
      modality: { name: modalidade.name, slug: modalidade.slug },
    })),
  }));

  return {
    modalidades,
    /** Com mais de uma, cada faixa precisa dizer de qual modalidade é. */
    variasModalidades: modalidades.length > 1,
    isLoading: query.isLoading,
    isError: query.isError && !query.data,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
