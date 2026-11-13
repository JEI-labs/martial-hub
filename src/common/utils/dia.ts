/**
 * Dia do calendário — a data de uma graduação, por exemplo — e não um
 * instante.
 *
 * Um dia é guardado em coluna `@db.Date` e circula como um `Date` à
 * meia-noite UTC, que é como o Prisma lê e grava essas colunas. Misturar isso
 * com instantes (a hora de agora, ou meia-noite no fuso de quem olha) era o
 * que deixava uma graduação de hoje "mais antiga" que outra de hoje, e as
 * datas um dia antes no Brasil.
 *
 * O "hoje" é o de São Paulo: é o fuso das academias, e não o do servidor
 * (UTC, onde depois das 21h já é amanhã).
 */
const FUSO = 'America/Sao_Paulo';

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** O dia do calendário de um instante, no fuso das academias. */
export function diaDe(instante: Date = new Date()): Date {
  const [ano, mes, dia] = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(instante)
    .split('-')
    .map(Number);

  return new Date(Date.UTC(ano!, mes! - 1, dia!));
}

/**
 * "dd/mm/aaaa" vira o dia, ou `null` se a data não existe: "31/02/2026" não
 * vira 03/03 em silêncio, e "45/13/2026" não vira Invalid Date.
 */
export function diaDoTexto(texto: string): Date | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!partes) return null;

  const [, dia, mes, ano] = partes.map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1, dia!));

  return data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes! - 1 &&
    data.getUTCDate() === dia
    ? data
    : null;
}

/** O dia como "dd/mm/aaaa", lido em UTC — sem voltar um dia no Brasil. */
export function formatarDia(dia: Date | string): string {
  const data = new Date(dia);
  return `${doisDigitos(data.getUTCDate())}/${doisDigitos(
    data.getUTCMonth() + 1,
  )}/${data.getUTCFullYear()}`;
}
