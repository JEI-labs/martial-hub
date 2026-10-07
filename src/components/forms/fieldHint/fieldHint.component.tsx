'use client';

import { HelpCircle } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Ícone de ajuda ao lado do rótulo, para campos cujo nome não basta
 * (o que conta como "Referência", o que cada status significa, etc.).
 */
export function FieldHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            // o rótulo inteiro é um <label>; sem isto, clicar na ajuda
            // focaria o campo em vez de abrir a dica
            onClick={(event) => event.preventDefault()}
            className="text-muted-foreground hover:text-foreground ml-1 inline-flex align-middle"
            aria-label={text}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[15rem]">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
