/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import './src/env.js';

/** @type {import("next").NextConfig} */
const config = {
  /**
   * Multi-tenant em desenvolvimento acontece em subdomínio
   * (academia.lvh.me:3000, que resolve para 127.0.0.1 sem mexer em DNS). Sem
   * liberar essas origens, o Next 16 recusa as requisições do próprio app e a
   * tela fica em esqueleto para sempre.
   */
  allowedDevOrigins: ['*.lvh.me', '*.localhost', '*.local'],

  /**
   * As rotas passaram para português. Isto mantém de pé o que já estava
   * aberto, favoritado ou compartilhado — temporário, não permanente, porque
   * um 308 fica gravado no navegador e atrapalharia se mudarmos de ideia.
   */
  async redirects() {
    return [
      { source: '/dashboard', destination: '/painel', permanent: false },
      {
        source: '/students/:id/payments',
        destination: '/alunos/:id/pagamentos',
        permanent: false,
      },
      {
        source: '/students/:path*',
        destination: '/alunos/:path*',
        permanent: false,
      },
      {
        source: '/financial/summary',
        destination: '/financeiro/resumo',
        permanent: false,
      },
      {
        source: '/financial/revenues',
        destination: '/financeiro/receitas',
        permanent: false,
      },
      {
        source: '/financial/expenses',
        destination: '/financeiro/despesas',
        permanent: false,
      },
      { source: '/financial', destination: '/financeiro', permanent: false },
      {
        source: '/registrations/plans',
        destination: '/cadastros/planos',
        permanent: false,
      },
      {
        source: '/registrations/categories',
        destination: '/cadastros/categorias',
        permanent: false,
      },
      {
        source: '/registrations/promotions',
        destination: '/cadastros/promocoes',
        permanent: false,
      },
      {
        source: '/registrations/suppliers',
        destination: '/cadastros/fornecedores',
        permanent: false,
      },
      { source: '/registrations', destination: '/cadastros', permanent: false },
      { source: '/settings', destination: '/configuracoes', permanent: false },
      { source: '/profile', destination: '/perfil', permanent: false },
      { source: '/security', destination: '/seguranca', permanent: false },
      { source: '/auth/login', destination: '/auth/entrar', permanent: false },
    ];
  },
  images: {
    // `images.domains` was removed in Next 16 — everything is a remotePattern now.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'my-blob-store.public.blob.vercel-storage.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'yqmujiufpgt9jxbw.public.blob.vercel-storage.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
        port: '',
      },
    ],
  },
};

export default config;
