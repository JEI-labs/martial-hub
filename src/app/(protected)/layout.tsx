import { redirect } from 'next/navigation';
import { ETenantStatus, EUserRole } from '@prisma/client';

import { BreadcrumbContainer } from '@/components/layout/BreadcrumbContainer';
import { UserProfileContainer } from '@/components/layout/UserProfileContainer';
import { ThemeToggler } from '@/components/theme/theme-toggler';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { TenantTheme } from '@/components/theme/tenantTheme.component';
import AppSidebarProvider from '@/providers/sidebarProvider';
import { getServerAuthSession } from '@/server/auth';
import { getCurrentTenant } from '@/server/tenant/resolve';
import { temFaturaVencida } from '@/server/billing/invoices';
import { TenantBlocked } from '@/components/layout/tenantBlocked.component';
import { SupportBanner } from '@/components/layout/supportBanner.component';
import { BillingBanner } from '@/components/tenant/billingBanner.component';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, tenant] = await Promise.all([
    getServerAuthSession(),
    getCurrentTenant(),
  ]);

  if (!session) redirect('/auth/entrar');

  /* O dono do sistema não pertence a academia nenhuma: toda consulta daqui
     filtraria por um tenant que ele não tem. A exceção é o acesso de
     suporte, que carrega na sessão a academia que ele foi visitar — e só
     vale no endereço dela. */
  const emSuporte =
    session.user.role === EUserRole.MASTER &&
    Boolean(session.user.supportTenantId) &&
    session.user.supportTenantId === tenant?.id;

  if (session.user.role === EUserRole.MASTER && !emSuporte) {
    redirect('/master');
  }

  /* O endereço diz de quem é a casa. Logar numa academia e navegar na outra
     trocando o host tem que esbarrar aqui, não só no login. */
  if (tenant && !emSuporte && session.user.tenantId !== tenant.id) {
    redirect('/auth/entrar');
  }

  /* Endereço que não é de academia nenhuma. Em desenvolvimento não há domínio
     para resolver, então segue. */
  if (!tenant && process.env.NODE_ENV !== 'development') {
    redirect('/auth/entrar');
  }

  if (
    tenant &&
    tenant.status !== ETenantStatus.ACTIVE &&
    tenant.status !== ETenantStatus.TRIAL
  ) {
    /* Bloqueio por fatura tem conserto conhecido, e dizer isso poupa um
       telefonema: a tela explica o motivo em vez de só negar a entrada. */
    const porFatura = await temFaturaVencida(tenant.id);

    return <TenantBlocked tenantName={tenant.name} porFatura={porFatura} />;
  }

  return (
    <AppSidebarProvider>
      <TenantTheme primaryColor={tenant?.branding?.primaryColor} />
      <div className="bg-background flex h-full w-full flex-col md:px-8">
        {/* Dentro da coluna de conteúdo: ao lado da sidebar, no flex do
            provider, a tarja virava uma irmã dela e caía no meio da tela. */}
        {emSuporte && tenant && <SupportBanner tenantName={tenant.name} />}

        {/* Cobrança do sistema é assunto de quem assinou: recepção e professor
            não decidem pagar e não precisam ver. */}
        {session.user.role === EUserRole.OWNER && <BillingBanner />}

        <div className="min-h-[calc(100vh-2rem)]">
          <div className="bg-card shadow-card flex items-center justify-between px-4 py-3 md:mt-6 md:rounded-2xl md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="hidden md:flex">
                <BreadcrumbContainer />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggler />
              <UserProfileContainer />
            </div>
          </div>
          {/* pb-10: sem isso o último elemento de qualquer página encosta
                no fim da viewport */}
          <div className="mt-6 flex justify-center pb-10 max-md:px-6">
            {children}
          </div>
        </div>
      </div>
    </AppSidebarProvider>
  );
}
