import { cookies } from 'next/headers';

import { AppSidebar } from '@/components/layout/sidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { getCurrentTenant } from '@/server/tenant/resolve';

/** Igual a SIDEBAR_COOKIE_NAME em components/ui/sidebar.tsx */
const SIDEBAR_COOKIE_NAME = 'sidebar_state';

export default async function AppSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // O SidebarTrigger grava o estado nesse cookie, mas nada o lia de volta:
  // a sidebar reabria a cada navegação. Lendo no servidor o estado persiste
  // e já vem certo no primeiro paint, sem piscar.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== 'false';

  const tenant = await getCurrentTenant();

  return (
    <SidebarProvider className="bg-background" defaultOpen={defaultOpen}>
      <AppSidebar
        logoUrl={tenant?.branding?.logoUrl}
        tenantName={tenant?.name}
      />
      {children}
    </SidebarProvider>
  );
}
