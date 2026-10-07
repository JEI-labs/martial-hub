import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

interface PageIntroProps {
  icon: LucideIcon;
  /** A pergunta que a tela responde, ex.: "O que é uma categoria?". */
  title: string;
  /** O que é e para que serve, em uma ou duas frases. */
  children: React.ReactNode;
  /** Caso concreto, para quem nunca viu a tela saber o que cadastrar. */
  example: React.ReactNode;
}

/**
 * Explicação curta no topo das telas de cadastro. Quem abre "Categorias" pela
 * primeira vez não tem como adivinhar que categoria é a gaveta do financeiro —
 * e essa dúvida não cabe num placeholder de campo.
 */
export function PageIntro({
  icon: Icon,
  title,
  children,
  example,
}: PageIntroProps) {
  return (
    <Card>
      <CardContent className="flex gap-4 p-5">
        <span className="bg-muted text-muted-foreground hidden size-10 shrink-0 items-center justify-center rounded-xl sm:flex">
          <Icon className="size-5" />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-muted-foreground text-sm">{children}</p>
          </div>

          <p className="bg-muted text-muted-foreground rounded-xl px-3 py-2 text-sm">
            <span className="text-foreground font-medium">Exemplo: </span>
            {example}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
