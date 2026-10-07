// hooks/useStateCityOptions.ts
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  fetchStates,
  fetchCities,
  IBGEState,
  IBGECity,
} from '@/utils/api/ibge';

export interface Option {
  value: string;
  textValue: string;
}

/**
 * Hook para alimentar selects de Estado → Cidade, já trazendo
 * as cidades iniciais a partir de `initialState`.
 *
 * @param selectedState Sigla do estado atualmente selecionado no form
 * @param initialState  Sigla do estado do fornecedor (edição), se houver
 */
export function useStateCityOptions(
  selectedState: string,
  initialState?: string,
) {
  const { toast } = useToast();
  const [rawStates, setRawStates] = useState<Array<IBGEState>>([]);
  const [statesLoaded, setStatesLoaded] = useState(false);
  const [rawCities, setRawCities] = useState<Array<IBGECity>>([]);
  const [citiesLoadedFor, setCitiesLoadedFor] = useState<string | undefined>(
    undefined,
  );

  // Estado cujas cidades devem aparecer: o escolhido pelo usuário, caindo
  // para o do fornecedor enquanto ele ainda não escolheu (edição).
  const cityState = selectedState || initialState;

  // Derivados em vez de guardados, para nenhum efeito precisar ligar a flag
  // de forma síncrona (o que dispara um render em cascata).
  const loadingStates = !statesLoaded;
  const loadingCities = Boolean(cityState) && citiesLoadedFor !== cityState;

  // 1) busca todos os estados uma vez
  useEffect(() => {
    let cancelled = false;

    fetchStates()
      .then((states) => {
        if (!cancelled) setRawStates(states);
      })
      .catch(() => {
        if (!cancelled)
          toast({ title: 'Erro ao carregar estados', variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setStatesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  // 2) carrega as cidades do estado corrente; o guard de cancelamento evita
  //    que uma resposta lenta de um estado antigo sobrescreva a atual.
  useEffect(() => {
    if (!cityState) return;

    let cancelled = false;

    fetchCities(cityState)
      .then((cities) => {
        if (!cancelled) setRawCities(cities);
      })
      .catch(() => {
        if (!cancelled)
          toast({ title: 'Erro ao carregar cidades', variant: 'destructive' });
      })
      .finally(() => {
        if (!cancelled) setCitiesLoadedFor(cityState);
      });

    return () => {
      cancelled = true;
    };
  }, [cityState, toast]);

  // transforma em Option para o select
  const statesOptions = useMemo<Array<Option>>(
    () => rawStates.map((st) => ({ value: st.sigla, textValue: st.nome })),
    [rawStates],
  );

  const citiesOptions = useMemo<Array<Option>>(
    () => rawCities.map((ct) => ({ value: ct.nome, textValue: ct.nome })),
    [rawCities],
  );

  return { statesOptions, citiesOptions, loadingStates, loadingCities };
}
