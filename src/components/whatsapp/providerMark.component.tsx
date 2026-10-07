import type { EWhatsappProvider } from '@prisma/client';
import { SiMeta } from 'react-icons/si';

import { cn } from '@/lib/utils';

/**
 * Marca de cada provedor. A da Meta vem do react-icons (glifo oficial da
 * marca); Evolution e Z-API não têm ícone em biblioteca nenhuma, então são
 * desenhos próprios — para usar os oficiais, basta soltar os SVGs em
 * `public/providers/` e trocar o `glyph` por um <Image />.
 */
interface ProviderInfo {
  name: string;
  /** Uma linha sobre o que é, mostrada no formulário. */
  summary: string;
  className: string;
  glyph: React.ReactNode;
}

export const WHATSAPP_PROVIDERS: Record<EWhatsappProvider, ProviderInfo> = {
  EVOLUTION: {
    name: 'Evolution API',
    summary: 'Servidor próprio, número comum, texto livre a qualquer hora.',
    className: 'bg-emerald-500/15 text-emerald-400',
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <path
          d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  META: {
    name: 'Meta Cloud API',
    summary: 'Oficial do WhatsApp. Exige templates aprovados fora das 24h.',
    className: 'bg-sky-500/15 text-sky-400',
    glyph: <SiMeta className="size-5" />,
  },
  ZAPI: {
    name: 'Z-API',
    summary: 'Serviço pago de terceiro, com instância e token próprios.',
    className: 'bg-violet-500/15 text-violet-400',
    glyph: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
        <path
          d="M7 6h10L8 18h10"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
};

export function ProviderMark({
  provider,
  className,
}: {
  provider: EWhatsappProvider;
  className?: string;
}) {
  const info = WHATSAPP_PROVIDERS[provider];

  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-xl',
        info.className,
        className,
      )}
      title={info.name}
    >
      {info.glyph}
    </span>
  );
}
