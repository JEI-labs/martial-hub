import { EUserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { env } from '@/env';
import { getServerAuthSession } from '@/server/auth';
import { getCurrentTenant } from '@/server/tenant/resolve';
import { exigeDoisFatores, temDoisFatores } from '@/server/auth/twoFactor';
import { TwoFactorRequired } from '@/components/security/twoFactorRequired.component';
import { ThemeToggler } from '@/components/theme/theme-toggler';
import { MasterNav } from '@/components/master/masterNav.component';
import { MasterUserMenu } from '@/components/master/masterUserMenu.component';

/**
 * A casa do dono do sistema. Fora da área das academias de propósito: aqui
 * não existe tenant, e nada desta árvore passa pelo filtro por academia.
 */
export default async function MasterLayout({
  children,
}: LayoutProps<'/master'>) {
  const [session, tenant] = await Promise.all([
    getServerAuthSession(),
    getCurrentTenant(),
  ]);

  if (!session) redirect('/auth/entrar');
  if (session.user.role !== EUserRole.MASTER) redirect('/painel');

  /* O painel do negócio não mora no endereço de cliente nenhum: deixá-lo
     responder em academia.seusistema.com.br (ou pior, no domínio próprio do
     cliente) é anunciar a existência dele onde não devia. */
  if (tenant) {
    redirect(
      env.ROOT_DOMAIN ? `https://app.${env.ROOT_DOMAIN}/master` : '/painel',
    );
  }

  /* O dono do sistema enxerga todas as academias; sem segunda etapa, uma
     senha vazada entregaria todas de uma vez. */
  if (
    exigeDoisFatores(session.user.role) &&
    !(await temDoisFatores(session.user.id))
  ) {
    return <TwoFactorRequired nome={session.user.name} />;
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card shadow-card sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Thai-Boxe Manager</span>

            <MasterNav />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggler />
            <MasterUserMenu nome={session.user.name} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
