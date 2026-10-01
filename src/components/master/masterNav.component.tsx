'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, FileText, LayoutDashboard } from 'lucide-react';

import { cn } from '@/lib/utils';

const menu = [
  { href: '/master', label: 'Painel', icon: LayoutDashboard },
  { href: '/master/clientes', label: 'Clientes', icon: Building2 },
  { href: '/master/faturas', label: 'Faturas', icon: FileText },
];

/**
 * Navegação do master. Client component porque o item ativo depende da rota —
 * no servidor não dá para saber em qual delas a pessoa está.
 */
export function MasterNav() {
  const path = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {menu.map((item) => {
        /* Painel é a raiz: sem o exato, ele ficaria aceso em toda tela do
           master. Os outros acendem nas telas de dentro, para a ficha de um
           cliente continuar sendo "Clientes". */
        const ativo =
          item.href === '/master'
            ? path === '/master'
            : path.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
              ativo
                ? 'bg-primary/15 text-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
