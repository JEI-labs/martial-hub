import '@/styles/globals.css';

import { GeistSans } from 'geist/font/sans';
import { type Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/components/reactquery/query-provider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TRPCReactProvider } from '@/trpc/react';
import { BreadcrumbProvider } from '@/contexts/breadcrumb';
import { NextAuthProvider } from '@/server/auth/sessionprovider';
import { NOME_DO_SISTEMA } from '@/common/constants/sistema';
import { getCurrentTenant } from '@/server/tenant/resolve';

/**
 * A aba também é parte da marca.
 *
 * Título e ícone saem do endereço, como o resto: a academia aparece com o
 * nome e a logo dela, e o painel do dono do sistema com os nossos. O que
 * havia aqui era fixo — o nome e o favicon de uma academia específica, na aba
 * de todos os clientes.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();

  /* Sem logo enviada fica o ícone neutro: a nossa marca na aba de um cliente
     seria o mesmo erro, invertido. */
  const icone = tenant?.branding?.logoUrl ?? '/icone-sistema.svg';

  return {
    title: tenant?.name ?? NOME_DO_SISTEMA,
    description: tenant
      ? `Sistema de gestão da ${tenant.name}`
      : 'Gestão para academias de artes marciais',
    icons: [{ rel: 'icon', url: icone }],
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <NextAuthProvider>
          <TRPCReactProvider>
            <QueryProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem
                disableTransitionOnChange
              >
                <BreadcrumbProvider>
                  <TooltipProvider>
                    {children}
                    <Toaster />
                  </TooltipProvider>
                </BreadcrumbProvider>
              </ThemeProvider>
            </QueryProvider>
          </TRPCReactProvider>
        </NextAuthProvider>
      </body>
    </html>
  );
}
