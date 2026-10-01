import { ImageIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * O que aparece enquanto a academia não enviou a marca dela.
 *
 * Antes caía na logo e na foto da Thaiboxe, que é uma academia como as
 * outras: cliente novo abria o sistema com a marca de um concorrente. Estes
 * marcadores dizem o que falta e onde, e desaparecem no instante em que a
 * imagem é enviada. São markup, não arquivo, porque assim seguem o tema e a
 * cor da academia em vez de serem um PNG cinza fixo.
 */

export function LogoPlaceholder({
  className,
  label = 'Sua logo',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'border-muted-foreground/30 text-muted-foreground flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4',
        className,
      )}
    >
      <ImageIcon className="size-4 shrink-0" aria-hidden />
      <span className="text-sm font-medium whitespace-nowrap">{label}</span>
    </div>
  );
}

export function LoginImagePlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-muted relative flex h-full w-full items-center justify-center overflow-hidden',
        className,
      )}
    >
      {/* Xadrez discreto: diz "aqui entra imagem" sem competir com o
          formulário ao lado. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(45deg, currentColor 25%, transparent 25%), linear-gradient(-45deg, currentColor 25%, transparent 25%), linear-gradient(45deg, transparent 75%, currentColor 75%), linear-gradient(-45deg, transparent 75%, currentColor 75%)',
          backgroundSize: '28px 28px',
          backgroundPosition: '0 0, 0 14px, 14px -14px, -14px 0',
        }}
      />

      <div className="text-muted-foreground relative flex flex-col items-center gap-3 px-8 text-center">
        <span className="border-muted-foreground/30 flex size-14 items-center justify-center rounded-full border-2 border-dashed">
          <ImageIcon className="size-6" aria-hidden />
        </span>

        <p className="text-foreground text-lg font-medium">
          Sua imagem de login aqui
        </p>
        <p className="max-w-xs text-sm">
          Envie uma foto da academia em Configurações › Aparência. Horizontal, a
          partir de 1600px de largura.
        </p>
      </div>
    </div>
  );
}
