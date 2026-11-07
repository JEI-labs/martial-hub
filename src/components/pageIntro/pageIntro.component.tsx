import type { LucideIcon } from 'lucide-react';

interface PageIntroProps {
  icon: LucideIcon;
  /** O nome do assunto da tela, em uma ou duas palavras. */
  title: string;
  /** O que é, numa linha. Se não couber numa linha, não cabe aqui. */
  children: React.ReactNode;
}

/**
 * Uma linha dizendo do que a tela trata.
 *
 * Era um cartão com parágrafo e um bloco de exemplo. Ninguém lê três frases
 * para chegar a uma tabela — e no celular aquilo empurrava o conteúdo para
 * fora da primeira tela. O que não couber aqui pertence ao campo a que se
 * refere, não ao topo da página.
 */
export function PageIntro({ icon: Icon, title, children }: PageIntroProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" />
      </span>

      <div className="min-w-0">
        <p className="leading-tight font-medium">{title}</p>
        <p className="text-muted-foreground text-sm leading-tight">
          {children}
        </p>
      </div>
    </div>
  );
}
