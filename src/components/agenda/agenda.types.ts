import type { RouterOutputs } from '@/trpc/react';

/** Uma aula já expandida, como a tela recebe do servidor. */
export type Aula = RouterOutputs['agenda']['list'][number];

export type Visao = 'dia' | 'semana' | 'mes';

/** Primeira e última hora desenhadas na grade. */
export const HORA_INICIAL = 6;
export const HORA_FINAL = 23;
/** Altura de uma hora, em pixels. Define a escala da grade inteira. */
export const ALTURA_HORA = 56;
