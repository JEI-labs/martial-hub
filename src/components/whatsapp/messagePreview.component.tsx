'use client';

import { Check } from 'lucide-react';

/**
 * Prévia do modelo como o aluno vê. As cores aqui são as do WhatsApp de
 * propósito — é uma réplica da tela dele, não um componente do nosso tema, e
 * um balão no coral da academia não diria nada sobre como a mensagem chega.
 */
const SAMPLE: Record<string, string> = {
  aluno: 'Maria Silva Souza',
  primeiro_nome: 'Maria',
};

/** Mesma regra do servidor: {{campo}} vira o valor. */
function render(body: string) {
  return body.replace(
    /\{\{\s*([\w]+)\s*\}\}/g,
    (match, key: string) => SAMPLE[key] ?? match,
  );
}

export function MessagePreview({ body }: { body: string }) {
  const text = render(body).trim();

  return (
    <div className="overflow-hidden rounded-2xl bg-[#e5ddd5] p-3 dark:bg-[#0b141a]">
      <div className="flex justify-end">
        <div className="relative max-w-[85%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {text || 'Escreva a mensagem para ver a prévia.'}
          </p>

          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781] dark:text-[#8696a0]">
            09:41
            {/* dois tiques, como a marca de entregue */}
            <span className="relative flex">
              <Check className="size-3 text-[#53bdeb]" />
              <Check className="-ml-1.5 size-3 text-[#53bdeb]" />
            </span>
          </span>
        </div>
      </div>

      <p className="text-muted-foreground mt-2 text-center text-[10px]">
        Prévia com dados de exemplo — {SAMPLE.aluno}
      </p>
    </div>
  );
}
