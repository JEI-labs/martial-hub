/**
 * Catálogo inicial de graduações por modalidade.
 *
 * Não é a fonte da verdade: as faixas moram na tabela `Graduation`, uma lista
 * por modalidade de cada academia. Isto é só o que uma modalidade recebe ao
 * nascer, para a academia não começar do zero. Modalidade fora do catálogo
 * (boxe, ou um nome livre como "Muay Thai Kids") nasce sem graduação nenhuma.
 *
 * A migration `graduations_per_modality` tem uma cópia destes dados: ela é o
 * retrato do momento em que rodou, e mudar o catálogo aqui não reescreve o
 * que já está no banco.
 */
export interface GraduationSeed {
  /** Nome da faixa, como em "Vermelho e Azul Claro". */
  name: string;
  /** Nível correspondente: Iniciante, Instrutor, Mestre… */
  level: string | null;
  /** Cores da faixa, de cima para baixo, em hex. */
  colors: Array<string>;
}

const WHITE = '#ffffff';
const RED = '#e11d1d';
const LIGHT_BLUE = '#22a3e0';
const DARK_BLUE = '#1414c8';
const BLACK = '#111111';
const GRAY = '#9ca3af';
const YELLOW = '#facc15';
const ORANGE = '#f97316';
const GREEN = '#16a34a';
const BLUE = '#2563eb';
const PURPLE = '#7e22ce';
const BROWN = '#78350f';

/** Kruang-Prajied, na ordem em que aparece na fita. */
const MUAY_THAI: Array<GraduationSeed> = [
  { name: 'Branco', level: 'Iniciante', colors: [WHITE] },
  { name: 'Vermelho e Branco', level: 'Iniciante', colors: [WHITE, RED] },
  { name: 'Vermelho', level: 'Iniciante', colors: [RED] },
  {
    name: 'Vermelho e Azul Claro',
    level: 'Intermediário',
    colors: [RED, LIGHT_BLUE],
  },
  { name: 'Azul Claro', level: 'Intermediário', colors: [LIGHT_BLUE] },
  {
    name: 'Azul Claro e Azul Escuro',
    level: 'Intermediário',
    colors: [LIGHT_BLUE, DARK_BLUE],
  },
  { name: 'Azul Escuro', level: 'Instrutor Auxiliar', colors: [DARK_BLUE] },
  {
    name: 'Azul Escuro e Preto',
    level: 'Instrutor',
    colors: [DARK_BLUE, BLACK],
  },
  { name: 'Preto', level: 'Professor', colors: [BLACK] },
  { name: 'Preto e Branco', level: 'Mestre', colors: [BLACK, WHITE] },
  {
    name: 'Preto, Branco e Vermelho',
    level: 'Grão-Mestre',
    colors: [BLACK, WHITE, RED],
  },
];

/**
 * Infantil primeiro, depois adulto: é a ordem em que um aluno que começa
 * criança atravessa as faixas.
 */
const JIU_JITSU: Array<GraduationSeed> = [
  { name: 'Branca', level: 'Infantil e adulto', colors: [WHITE] },
  { name: 'Cinza e Branca', level: 'Infantil', colors: [GRAY, WHITE] },
  { name: 'Cinza', level: 'Infantil', colors: [GRAY] },
  { name: 'Cinza e Preta', level: 'Infantil', colors: [GRAY, BLACK] },
  { name: 'Amarela e Branca', level: 'Infantil', colors: [YELLOW, WHITE] },
  { name: 'Amarela', level: 'Infantil', colors: [YELLOW] },
  { name: 'Amarela e Preta', level: 'Infantil', colors: [YELLOW, BLACK] },
  { name: 'Laranja e Branca', level: 'Infantil', colors: [ORANGE, WHITE] },
  { name: 'Laranja', level: 'Infantil', colors: [ORANGE] },
  { name: 'Laranja e Preta', level: 'Infantil', colors: [ORANGE, BLACK] },
  { name: 'Verde e Branca', level: 'Infantil', colors: [GREEN, WHITE] },
  { name: 'Verde', level: 'Infantil', colors: [GREEN] },
  { name: 'Verde e Preta', level: 'Infantil', colors: [GREEN, BLACK] },
  { name: 'Azul', level: 'Adulto', colors: [BLUE] },
  { name: 'Roxa', level: 'Adulto', colors: [PURPLE] },
  { name: 'Marrom', level: 'Adulto', colors: [BROWN] },
  { name: 'Preta', level: 'Adulto', colors: [BLACK] },
  { name: 'Vermelha e Preta', level: 'Mestre', colors: [RED, BLACK] },
  { name: 'Vermelha e Branca', level: 'Mestre', colors: [RED, WHITE] },
  { name: 'Vermelha', level: 'Grão-Mestre', colors: [RED] },
];

const KARATE: Array<GraduationSeed> = [
  { name: 'Branca', level: 'Iniciante', colors: [WHITE] },
  { name: 'Amarela', level: 'Iniciante', colors: [YELLOW] },
  { name: 'Vermelha', level: 'Iniciante', colors: [RED] },
  { name: 'Laranja', level: 'Intermediário', colors: [ORANGE] },
  { name: 'Verde', level: 'Intermediário', colors: [GREEN] },
  { name: 'Roxa', level: 'Avançado', colors: [PURPLE] },
  { name: 'Marrom', level: 'Avançado', colors: [BROWN] },
  { name: 'Preta', level: 'Faixa preta', colors: [BLACK] },
];

const JUDO: Array<GraduationSeed> = [
  { name: 'Branca', level: 'Iniciante', colors: [WHITE] },
  { name: 'Cinza', level: 'Iniciante', colors: [GRAY] },
  { name: 'Azul', level: 'Iniciante', colors: [BLUE] },
  { name: 'Amarela', level: 'Intermediário', colors: [YELLOW] },
  { name: 'Laranja', level: 'Intermediário', colors: [ORANGE] },
  { name: 'Verde', level: 'Intermediário', colors: [GREEN] },
  { name: 'Roxa', level: 'Avançado', colors: [PURPLE] },
  { name: 'Marrom', level: 'Avançado', colors: [BROWN] },
  { name: 'Preta', level: 'Faixa preta', colors: [BLACK] },
];

/**
 * As faixas de cada modalidade, pelo slug dela (o nome em minúsculas e sem
 * acento). É pelo slug que "Karatê" e "karate" recebem o mesmo catálogo.
 */
export const GRADUATION_CATALOG: Readonly<
  Record<string, ReadonlyArray<GraduationSeed>>
> = {
  'muay-thai': MUAY_THAI,
  'jiu-jitsu': JIU_JITSU,
  'karate': KARATE,
  'judo': JUDO,
};

/**
 * O que criar de graduação para uma modalidade recém-nascida, já com a
 * ordem. Lista vazia para quem não está no catálogo.
 */
export function graduacoesDoCatalogo(slug: string) {
  return (GRADUATION_CATALOG[slug] ?? []).map((faixa, position) => ({
    name: faixa.name,
    level: faixa.level,
    colors: [...faixa.colors],
    position,
  }));
}
