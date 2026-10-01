/**
 * Cor da academia aplicada por cima dos tokens do tema.
 *
 * O valor vem em HSL cru ("9 60% 50%"), que é o formato que `globals.css` usa
 * — então ele entra direto como variável, sem conversão, e vale para os dois
 * temas. Em `<head>` para a cor já estar valendo no primeiro desenho, sem o
 * laranja padrão piscando antes.
 */
export function TenantTheme({
  primaryColor,
}: {
  primaryColor?: string | null;
}) {
  if (!primaryColor) return null;

  const css = `:root,:root[data-theme="dark"],.dark{--primary:${primaryColor};--sidebar-primary:${primaryColor};--sidebar-ring:${primaryColor};--ring:${primaryColor};--chart-1:${primaryColor};}`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
