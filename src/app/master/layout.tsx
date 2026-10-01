import { EUserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Building2, FileText, LayoutDashboard, LogOut } from 'lucide-react';

import { getServerAuthSession } from '@/server/auth';
import { ThemeToggler } from '@/components/theme/theme-toggler';

const menu = [
  { href: '/master', label: 'Painel', icon: LayoutDashboard },
  { href: '/master/clientes', label: 'Clientes', icon: Building2 },
  { href: '/master/faturas', label: 'Faturas', icon: FileText },
];

/**
 * A casa do dono do sistema. Fora da área das academias de propósito: aqui
 * não existe tenant, e nada desta árvore passa pelo filtro por academia.
 */
export default async function MasterLayout({
  children,
}: LayoutProps<'/master'>) {
  const session = await getServerAuthSession();

  if (!session) redirect('/auth/entrar');
  if (session.user.role !== EUserRole.MASTER) redirect('/painel');

  return (
    <div className="bg-background min-h-screen">
      <header className="bg-card shadow-card sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-6">
            <span className="font-semibold">Thai-Boxe Manager</span>

            <nav className="flex items-center gap-1">
              {menu.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggler />
            <Link
              href="/api/auth/signout"
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm"
            >
              <LogOut className="size-4" />
              Sair
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
