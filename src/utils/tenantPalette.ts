/**
 * Paleta da academia a partir de uma cor só.
 *
 * O tema do sistema é construído sobre neutros de matiz 240 com saturação
 * baixa. Trocar só `--primary` deixava a academia com botão da cor dela e o
 * resto cinza-azulado de fábrica. Aqui a matiz escolhida passa a tingir
 * também fundo, cartão, barra lateral e bordas — de leve, porque fundo
 * saturado cansa a vista em tela cheia de número, e o que tem que saltar é o
 * dado, não a parede.
 */

export type PaletteVars = Record<string, string>;

type Hsl = { h: number; s: number; l: number };

export function parseHsl(triple: string | null | undefined): Hsl | null {
  const m = triple?.trim().match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!m) return null;

  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

const clamp = (valor: number, min: number, max: number) =>
  Math.min(max, Math.max(min, valor));

const hsl = ({ h, s, l }: Hsl) =>
  `${Math.round(h)} ${Math.round(clamp(s, 0, 100))}% ${Math.round(clamp(l, 0, 100))}%`;

/** Luminância relativa, para decidir se o texto por cima é claro ou escuro. */
function luminancia({ h, s, l }: Hsl): number {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  const setor = Math.floor(h / 60) % 6;
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][setor] ?? [c, x, 0];

  const canal = (v: number) => {
    const n = v + m;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };

  const [r, g, b] = rgb.map(canal) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: Hsl, b: Hsl): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

/** Texto que fica legível por cima da cor: branco ou quase preto. */
function textoSobre(cor: Hsl): Hsl {
  const branco = { h: 0, s: 0, l: 100 };
  const escuro = { h: cor.h, s: 20, l: 12 };

  return contraste(cor, branco) >= contraste(cor, escuro) ? branco : escuro;
}

/**
 * A cor escolhida pode ser escura ou clara demais para o papel que ela tem no
 * tema — um amarelo-claro como pílula do menu escuro some, um azul-marinho no
 * tema claro vira um borrão. Cada tema puxa a luminosidade para a sua faixa.
 */
function primariaDoTema(cor: Hsl, tema: 'light' | 'dark'): Hsl {
  const faixa = tema === 'dark' ? { min: 38, max: 68 } : { min: 32, max: 58 };
  return { ...cor, l: clamp(cor.l, faixa.min, faixa.max) };
}

export function buildTenantPalette(
  primaryTriple: string | null | undefined,
): { light: PaletteVars; dark: PaletteVars } | null {
  const cor = parseHsl(primaryTriple);
  if (!cor) return null;

  const h = cor.h;

  /* Saturação dos neutros: fração da cor escolhida, com teto. Cinza puro
     ignoraria a marca; muito mais que isto e o fundo começa a competir com o
     conteúdo. */
  const satEscuro = clamp(cor.s * 0.12, 3, 9);
  const satClaro = clamp(cor.s * 0.3, 8, 26);

  const escura = primariaDoTema(cor, 'dark');
  const clara = primariaDoTema(cor, 'light');

  const dark: PaletteVars = {
    '--background': hsl({ h, s: satEscuro, l: 12 }),
    '--card': hsl({ h, s: satEscuro, l: 19 }),
    '--popover': hsl({ h, s: satEscuro, l: 19 }),
    '--table-background': hsl({ h, s: satEscuro, l: 19 }),
    '--secondary': hsl({ h, s: satEscuro, l: 24 }),
    '--muted': hsl({ h, s: satEscuro, l: 24 }),
    '--accent': hsl({ h, s: satEscuro, l: 26 }),
    '--border': hsl({ h, s: satEscuro, l: 26 }),
    '--input': hsl({ h, s: satEscuro, l: 28 }),
    '--muted-foreground': hsl({ h, s: clamp(satEscuro, 3, 6), l: 68 }),
    '--primary': hsl(escura),
    '--primary-foreground': hsl(textoSobre(escura)),
    '--ring': hsl(escura),
    '--chart-1': hsl({ ...escura, l: clamp(escura.l + 8, 0, 100) }),
    '--sidebar-background': hsl({ h, s: satEscuro, l: 15 }),
    '--sidebar-accent': hsl({ h, s: satEscuro, l: 22 }),
    '--sidebar-border': hsl({ h, s: satEscuro, l: 24 }),
    '--sidebar-primary': hsl(escura),
    '--sidebar-primary-foreground': hsl(textoSobre(escura)),
    '--sidebar-ring': hsl(escura),
  };

  const light: PaletteVars = {
    '--background': hsl({ h, s: satClaro, l: 97 }),
    /* Cartão quase branco, não branco: no claro é ele que precisa saltar do
       fundo, e o degrau some se os dois forem 100%. */
    '--card': hsl({ h, s: clamp(satClaro, 0, 14), l: 99.5 }),
    '--popover': hsl({ h, s: clamp(satClaro, 0, 14), l: 99.5 }),
    '--table-background': hsl({ h, s: clamp(satClaro, 0, 14), l: 99.5 }),
    '--secondary': hsl({ h, s: satClaro, l: 93 }),
    '--muted': hsl({ h, s: satClaro, l: 93 }),
    '--accent': hsl({ h, s: satClaro, l: 90 }),
    '--border': hsl({ h, s: clamp(satClaro, 0, 18), l: 88 }),
    '--input': hsl({ h, s: clamp(satClaro, 0, 18), l: 88 }),
    '--muted-foreground': hsl({ h, s: clamp(satClaro, 4, 10), l: 46 }),
    '--primary': hsl(clara),
    '--primary-foreground': hsl(textoSobre(clara)),
    '--ring': hsl(clara),
    '--chart-1': hsl(clara),
    '--sidebar-background': hsl({ h, s: clamp(satClaro, 0, 14), l: 99 }),
    '--sidebar-accent': hsl({ h, s: satClaro, l: 94 }),
    '--sidebar-border': hsl({ h, s: clamp(satClaro, 0, 18), l: 90 }),
    '--sidebar-primary': hsl(clara),
    '--sidebar-primary-foreground': hsl(textoSobre(clara)),
    '--sidebar-ring': hsl(clara),
  };

  return { light, dark };
}

/** Vira o texto de um bloco CSS: `--background: 9 8% 12%;` por linha. */
export function paletteToCss(vars: PaletteVars): string {
  return Object.entries(vars)
    .map(([nome, valor]) => `${nome}:${valor};`)
    .join('');
}

/** Vira o objeto de `style`, para a prévia aplicar sem folha de estilo. */
export function paletteToStyle(vars: PaletteVars): React.CSSProperties {
  return Object.fromEntries(Object.entries(vars)) as React.CSSProperties;
}
