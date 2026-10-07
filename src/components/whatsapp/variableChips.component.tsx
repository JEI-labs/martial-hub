'use client';

import { Plus } from 'lucide-react';

import { MESSAGE_PLACEHOLDERS } from '@/common/constants/messageEvents';

/**
 * Botões das variáveis. Clicar insere no ponto onde o cursor está; arrastar
 * também funciona, porque o navegador solta o texto do `dataTransfer` dentro
 * da textarea sozinho — quem escreve não precisa digitar chave nenhuma.
 */
export function VariableChips({
  onInsert,
}: {
  onInsert: (_token: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-xs">Adicionar:</span>

      {MESSAGE_PLACEHOLDERS.map((placeholder) => (
        <button
          key={placeholder.token}
          type="button"
          draggable
          onDragStart={(event) =>
            event.dataTransfer.setData('text/plain', placeholder.token)
          }
          onClick={() => onInsert(placeholder.token)}
          title={`${placeholder.description} — ex.: ${placeholder.sample}`}
          className="bg-muted hover:bg-accent text-foreground flex cursor-grab items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors active:cursor-grabbing"
        >
          <Plus className="size-3" />
          {placeholder.label}
        </button>
      ))}
    </div>
  );
}
