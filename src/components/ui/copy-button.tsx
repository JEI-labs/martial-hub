'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Copia um texto curto — endereço, token — com retorno visual.
 *
 * `navigator.clipboard` só existe em contexto seguro: em http (que é como o
 * sistema roda em desenvolvimento, em subdomínio) ele vem undefined. Por isso
 * o caminho antigo com textarea fica como reserva, senão o botão não faria
 * nada justamente onde mais se testa.
 */
export function CopyButton({
  value,
  label = 'Copiar',
  className,
  size = 'sm',
  variant = 'outline',
  ...props
}: {
  value: string;
  label?: string;
} & Omit<ButtonProps, 'onClick' | 'value'>) {
  const [copiado, setCopiado] = useState(false);
  /* Sem rótulo, o botão é só o ícone — e o aviso de cópia tem de ser só o
     ícone também. Escrever "Copiado" ali dentro estourava a largura e passava
     por cima do que estava ao lado. */
  const soIcone = label === '';

  useEffect(() => {
    if (!copiado) return;
    const tempo = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(tempo);
  }, [copiado]);

  const copiar = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const campo = document.createElement('textarea');
        campo.value = value;
        campo.style.position = 'fixed';
        campo.style.opacity = '0';
        document.body.appendChild(campo);
        campo.select();
        document.execCommand('copy');
        document.body.removeChild(campo);
      }
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={copiar}
      className={cn(className)}
      {...props}
    >
      {copiado ? (
        <Check
          className={cn('size-4 text-green-600', !soIcone && 'mr-2')}
          aria-hidden
        />
      ) : (
        <Copy className={cn('size-4', !soIcone && 'mr-2')} aria-hidden />
      )}
      {!soIcone && (copiado ? 'Copiado' : label)}
    </Button>
  );
}
