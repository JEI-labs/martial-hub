import { buildTenantPalette, paletteToCss } from '@/utils/tenantPalette';

/**
 * A paleta da academia por cima dos tokens do tema.
 *
 * A cor escolhida não troca só o botão: dela saem fundo, cartão, barra
 * lateral e bordas, de leve, com a matiz tingindo os neutros. Os valores são
 * HSL cru porque é o formato que `globals.css` usa — entram direto.
 *
 * Os seletores são os mesmos do tema (`:root` e `.dark`, que é a classe do
 * next-themes), e isto vai no fim do `<head>` para já valer no primeiro
 * desenho, sem a cor de fábrica piscando antes.
 */
export function TenantTheme({
  primaryColor,
}: {
  primaryColor?: string | null;
}) {
  const paleta = buildTenantPalette(primaryColor);
  if (!paleta) return null;

  const css = `:root{${paletteToCss(paleta.light)}}.dark{${paletteToCss(paleta.dark)}}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
