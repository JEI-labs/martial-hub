import { EUserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { NOME_DO_SISTEMA } from '@/common/constants/sistema';
import { exigeDoisFatores } from '@/server/auth/twoFactor';
import { prisma } from '@/server/db';
import { TwoFactorRequired } from '@/components/security/twoFactorRequired.component';
import { PasswordChangeRequired } from '@/components/security/passwordChangeRequired.component';
import { getServerAuthSession } from '@/server/auth';
import { getCurrentTenant, masterHost } from '@/server/tenant/resolve';
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
    const casa = masterHost();
    redirect(casa ? `https://${casa}/master` : '/painel');
  }

  const conta = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true, twoFactorEnabledAt: true },
  });

  if (!conta) redirect('/auth/entrar');

  /* Conta criada por outro master entra com uma senha que mais alguém viu.
     Ela troca primeiro, e só depois configura a segunda etapa: ligar o 2FA
     em cima da senha temporária deixaria a porta pela metade. */
  if (conta.mustChangePassword) {
    return <PasswordChangeRequired nome={session.user.name} />;
  }

  /* O dono do sistema enxerga todas as academias; sem segunda etapa, uma
     senha vazada entregaria todas de uma vez. É a única parede que sobrou no
     sistema, e é aqui que ela faz sentido: são poucas contas, todas internas,
     e nenhuma delas está conhecendo o produto pela primeira vez. */
  if (exigeDoisFatores(session.user.role) && !conta.twoFactorEnabledAt) {
    return <TwoFactorRequired nome={session.user.name} destino="/master" />;
  }

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card shadow-card sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">{NOME_DO_SISTEMA}</span>

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
