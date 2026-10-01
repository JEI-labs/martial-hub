import { NOME_DO_SISTEMA } from '@/common/constants/sistema';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginForm } from '@/components/auth/loginForm.component';
import { getCurrentTenant } from '@/server/tenant/resolve';

/**
 * Server Component porque a moldura precisa saber de quem é a casa antes de
 * desenhar: o host diz a academia, e logo, foto e cor vêm dela.
 */
export default async function LoginPage() {
  const tenant = await getCurrentTenant();

  return (
    <AuthLayout>
      <LoginForm
        title={tenant ? `Bem-vindo à ${tenant.name}` : NOME_DO_SISTEMA}
        subtitle={
          tenant
            ? 'Entre com a sua conta'
            : 'Painel do sistema. Acesso restrito a quem o administra.'
        }
      />
    </AuthLayout>
  );
}
