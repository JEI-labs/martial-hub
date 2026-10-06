/**
 * Catálogo de sugestões para a academia não começar do zero. Não é uma tabela
 * global nem uma lista fechada: a academia escolhe destas o que quiser e pode
 * cadastrar qualquer outro nome ("Muay Thai Kids", "Boxe Feminino").
 */
export const MODALITY_CATALOG = [
  'Muay Thai',
  'Boxe',
  'Jiu-Jitsu',
  'MMA',
  'Karatê',
  'Judô',
  'Kickboxing',
  'Capoeira',
] as const;

/**
 * A modalidade com que toda academia nasce. É Muay Thai porque é o que o
 * sistema assumia até aqui — as faixas de `graduations.ts` são dela. A escolha
 * na criação da academia vem na #33.
 */
export const DEFAULT_MODALITY = 'Muay Thai';
