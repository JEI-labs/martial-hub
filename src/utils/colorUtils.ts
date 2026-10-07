/**
 * O tema guarda cor como HSL cru ("9 60% 50%") porque é assim que as
 * variáveis de `globals.css` são declaradas. Quem escolhe a cor, porém, mexe
 * com hexadecimal — então a tradução mora aqui, nos dois sentidos.
 */

/** "#c0502f" -> "9 60% 48%". Devolve null se não for hexadecimal válido. */
export function hexToHslTriple(hex: string): string | null {
  const limpo = hex.trim().replace('#', '');
  const completo =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo;

  if (!/^[0-9a-fA-F]{6}$/.test(completo)) return null;

  const r = parseInt(completo.slice(0, 2), 16) / 255;
  const g = parseInt(completo.slice(2, 4), 16) / 255;
  const b = parseInt(completo.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));

    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;

    h *= 60;
    if (h < 0) h += 360;
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** "9 60% 48%" -> "#c4502f". Para alimentar o seletor de cor do navegador. */
export function hslTripleToHex(triple: string | null | undefined): string {
  const padrao = '#c0502f';
  if (!triple) return padrao;

  const m = triple.trim().match(/^(\d{1,3})\s+(\d{1,3})%\s+(\d{1,3})%$/);
  if (!m) return padrao;

  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m2 = l - c / 2;

  const setor = Math.floor(h * 6) % 6;
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[setor] ?? [c, x, 0];

  const hex = (v: number) =>
    Math.round((v + m2) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
