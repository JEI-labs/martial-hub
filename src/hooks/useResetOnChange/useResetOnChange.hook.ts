import { useState } from 'react';

/**
 * Executa `reset` durante o render sempre que `deps` mudar.
 *
 * Fazer esse ajuste dentro de um `useEffect` faz o React confirmar o valor
 * velho na tela antes de renderizar de novo com o novo — o render em cascata
 * que a regra `react-hooks/set-state-in-effect` aponta. Ajustar durante o
 * render é o padrão que a documentação do React recomenda para esse caso.
 *
 * @see https://react.dev/learn/you-might-not-need-an-effect
 */
export const useResetOnChange = (
  deps: ReadonlyArray<unknown>,
  reset: () => void,
): void => {
  const key = JSON.stringify(deps);
  const [previousKey, setPreviousKey] = useState(key);

  if (previousKey !== key) {
    setPreviousKey(key);
    reset();
  }
};
