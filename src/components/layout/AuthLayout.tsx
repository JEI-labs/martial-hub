import * as React from 'react';

import Image from 'next/image';

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

  /* Sem academia no endereço é a porta do próprio sistema, e aí a marca do
     sistema é a certa. Com academia e sem marca enviada, o lugar fica
     reservado — a da Thaiboxe não serve para cliente nenhum. */
  const imagem = tenant
    ? tenant.branding?.loginImageUrl
    : '/images/thaiboxe.jpg';
  const logo = tenant ? tenant.branding?.logoUrl : '/images/logo.png';

  return (
    <div className="grid h-screen w-screen lg:grid-cols-2">
      <TenantTheme primaryColor={tenant?.branding?.primaryColor} />

      <div className="bg-muted hidden h-screen w-full overflow-hidden lg:block">
        {imagem ? (
          <Image
            src={imagem}
            alt={tenant ? `Academia ${tenant.name}` : 'Imagem de fundo'}
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
                  alt={tenant ? `Logo da ${tenant.name}` : 'Logo'}
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
