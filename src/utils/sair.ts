import { signOut } from 'next-auth/react';

/**
 * Sair sem sair do endereço.
 *
 * Quem redireciona não pode ser o NextAuth: ele confere o `callbackUrl` contra
 * o host configurado no servidor (`NEXTAUTH_URL`), que é de uma academia só, e
 * descarta qualquer outro. Em whitelabel isso jogava quem saía de uma academia
 * na tela de login de outra — com a marca da outra. Passar a origem atual não
 * resolve: ela também é descartada.
 *
 * Então o logout só apaga o cookie, e a navegação é nossa.
 */
export async function sairDaConta() {
  await signOut({ redirect: false });
  window.location.href = '/auth/entrar';
}
