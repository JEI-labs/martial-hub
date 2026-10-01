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
        <Check className="mr-2 size-4 text-green-600" aria-hidden />
      ) : (
        <Copy className="mr-2 size-4" aria-hidden />
      )}
      {copiado ? 'Copiado' : label}
    </Button>
  );
}
