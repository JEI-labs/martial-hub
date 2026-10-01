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
import { TenantBlocked } from '@/components/layout/tenantBlocked.component';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, tenant] = await Promise.all([
    getServerAuthSession(),
    getCurrentTenant(),
  ]);

  if (!session) redirect('/auth/entrar');

  const ehMaster = session.user.role === EUserRole.MASTER;

  /* O endereço diz de quem é a casa. Logar numa academia e navegar na outra
     trocando o host tem que esbarrar aqui, não só no login. */
  if (tenant && !ehMaster && session.user.tenantId !== tenant.id) {
    redirect('/auth/entrar');
  }

  /* Endereço que não é de academia nenhuma: só o dono do sistema passa. Em
     desenvolvimento não há domínio para resolver, então segue. */
  if (!tenant && !ehMaster && process.env.NODE_ENV !== 'development') {
    redirect('/auth/entrar');
  }

  if (
    tenant &&
    tenant.status !== ETenantStatus.ACTIVE &&
    tenant.status !== ETenantStatus.TRIAL
  ) {
    return <TenantBlocked tenantName={tenant.name} />;
  }

  return (
    <AppSidebarProvider>
      <TenantTheme primaryColor={tenant?.branding?.primaryColor} />
      <div className="bg-background flex h-full w-full flex-col md:px-8">
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
