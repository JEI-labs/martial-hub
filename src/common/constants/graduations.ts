import { EGraduation } from '@prisma/client';

/** Faixas de cor do Kruang-Prajied, na ordem em que aparecem na fita. */
export interface GraduationInfo {
  /** Número do grau, 1 a 11. */
  degree: number;
  /** Nome da graduação, como em "Vermelho e Azul Claro". */
  label: string;
  /** Nível correspondente: Iniciante, Instrutor, Mestre… */
  level: string;
  /** Cores da fita, de cima para baixo. */
  colors: Array<string>;
}

const WHITE = '#ffffff';
const RED = '#e11d1d';
const LIGHT_BLUE = '#22a3e0';
const DARK_BLUE = '#1414c8';
const BLACK = '#111111';

/**
 * Graduações fixas do Muay Thai. Ficam em código, e não numa tabela, porque
 * são padrão da modalidade — o professor escolhe entre elas, não as cadastra.
 */
export const GRADUATIONS: Record<EGraduation, GraduationInfo> = {
  GRAU_1: { degree: 1, label: 'Branco', level: 'Iniciante', colors: [WHITE] },
  GRAU_2: {
    degree: 2,
    label: 'Vermelho e Branco',
    level: 'Iniciante',
    colors: [WHITE, RED],
  },
  GRAU_3: { degree: 3, label: 'Vermelho', level: 'Iniciante', colors: [RED] },
  GRAU_4: {
    degree: 4,
    label: 'Vermelho e Azul Claro',
    level: 'Intermediário',
    colors: [RED, LIGHT_BLUE],
  },
  GRAU_5: {
    degree: 5,
    label: 'Azul Claro',
    level: 'Intermediário',
    colors: [LIGHT_BLUE],
  },
  GRAU_6: {
    degree: 6,
    label: 'Azul Claro e Azul Escuro',
    level: 'Intermediário',
    colors: [LIGHT_BLUE, DARK_BLUE],
  },
  GRAU_7: {
    degree: 7,
    label: 'Azul Escuro',
    level: 'Instrutor Auxiliar',
    colors: [DARK_BLUE],
  },
  GRAU_8: {
    degree: 8,
    label: 'Azul Escuro e Preto',
    level: 'Instrutor',
    colors: [DARK_BLUE, BLACK],
  },
  GRAU_9: { degree: 9, label: 'Preto', level: 'Professor', colors: [BLACK] },
  GRAU_10: {
    degree: 10,
    label: 'Preto e Branco',
    level: 'Mestre',
    colors: [BLACK, WHITE],
  },
  GRAU_11: {
    degree: 11,
    label: 'Preto, Branco e Vermelho',
    level: 'Grão-Mestre',
    colors: [BLACK, WHITE, RED],
  },
};

/** Na ordem dos graus, para selects e filtros. */
export const GRADUATION_LIST = Object.entries(GRADUATIONS)
  .map(([value, info]) => ({ value: value as EGraduation, ...info }))
  .sort((a, b) => a.degree - b.degree);
