import * as React from 'react';

import Image from 'next/image';

import { ShieldCheck } from 'lucide-react';

import { ScrollArea } from '../ui/scroll-area';
import { getCurrentTenant } from '@/server/tenant/resolve';
import { TenantTheme } from '@/components/theme/tenantTheme.component';
import {
  LoginImagePlaceholder,
  LogoPlaceholder,
} from '@/components/brand/brandPlaceholders.component';

/**
 * Moldura do login. Server Component de propósito: o endereço diz qual
 * academia é a casa, então a tela já abre com a logo, a foto e a cor do
 * cliente — antes de alguém digitar a senha.
 */
export async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const tenant = await getCurrentTenant();

  /* Endereço sem academia é a porta de serviço do próprio sistema: o painel
     do dono. Ela não leva marca nenhuma — as imagens que estavam aqui são de
     uma academia específica, e mostrar o cliente de alguém na entrada do
     sistema é o oposto de whitelabel. */
  if (!tenant) {
    return (
      <div className="bg-background flex min-h-screen w-full items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
          </div>

          {children}
        </div>
      </div>
    );
  }

  const imagem = tenant.branding?.loginImageUrl;
  const logo = tenant.branding?.logoUrl;

  return (
    <div className="grid h-screen w-screen lg:grid-cols-2">
      <TenantTheme primaryColor={tenant.branding?.primaryColor} />

      <div className="bg-muted hidden h-screen w-full overflow-hidden lg:block">
        {imagem ? (
          <Image
            src={imagem}
            alt={`Academia ${tenant.name}`}
            width="1920"
            height="1080"
            /* Imagem do cliente vem do Blob, de fora do projeto: sem o
               unoptimized o loader do Next tentaria otimizar um host que ele
               não conhece. */
            unoptimized={imagem.startsWith('http')}
            className="bg-muted-background h-full w-full object-cover"
          />
        ) : (
          <LoginImagePlaceholder />
        )}
      </div>

      <ScrollArea>
        <div className="flex min-h-screen w-full items-center">
          <div className="mx-auto flex h-fit max-w-[70%] min-w-[40%] flex-col gap-8 py-4">
            <div className="mb-[-30px] flex items-center justify-center">
              {logo ? (
                <Image
                  src={logo}
                  width={350}
                  height={350}
                  unoptimized={logo.startsWith('http')}
                  alt={`Logo da ${tenant.name}`}
                  className="h-auto max-h-[180px] w-auto object-contain"
                />
              ) : (
                <LogoPlaceholder className="h-20 w-48" />
              )}
            </div>
            {children}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
