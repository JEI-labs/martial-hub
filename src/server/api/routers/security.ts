import { NOME_DO_SISTEMA } from '@/common/constants/sistema';
import { createTRPCRouter, sessionProcedure } from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';
import { hash, verify } from 'argon2';
import { z } from 'zod';

import {
  conferirCodigo,
  exigeDoisFatores,
  gerarCodigosDeRecuperacao,
  gerarQrCode,
  gerarSegredo,
  protegerCodigos,
} from '@/server/auth/twoFactor';

/** Segurança da própria conta: cada um mexe na sua. */
export const securityRouter = createTRPCRouter({
  status: sessionProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.session.user.id },
      select: {
        role: true,
        twoFactorEnabledAt: true,
        twoFactorRecoveryCodes: true,
      },
    });

    return {
      ativo: Boolean(user.twoFactorEnabledAt),
      desde: user.twoFactorEnabledAt,
      obrigatorio: exigeDoisFatores(user.role),
      codigosRestantes: user.twoFactorRecoveryCodes.length,
    };
  }),

  /**
   * Primeiro passo: gera o segredo e devolve o QR.
   *
   * O segredo é guardado já aqui, mas `twoFactorEnabledAt` continua nulo —
   * ele só vale depois que a pessoa provar que o aplicativo está lendo o
   * código certo. Ligar antes disso tranca quem errou o cadastro.
   */
  startTwoFactor: sessionProcedure.mutation(async ({ ctx }) => {
    const segredo = gerarSegredo();

    const user = await ctx.prisma.user.update({
      where: { id: ctx.session.user.id },
      data: { twoFactorSecret: segredo, twoFactorEnabledAt: null },
      select: { email: true, tenant: { select: { name: true } } },
    });

    const { uri, qr } = await gerarQrCode(
      segredo,
      user.email,
      /* O nome que aparece no autenticador: a academia de quem é da
         academia, e o nosso para quem é dono do sistema. */
      user.tenant?.name ?? NOME_DO_SISTEMA,
    );

    /* O segredo em texto acompanha o QR porque nem todo aplicativo lê câmera,
       e porque é ele que a pessoa guarda se trocar de celular. */
    return { segredo, uri, qr };
  }),

  /** Segundo passo: confere o código e entrega os códigos de recuperação. */
  confirmTwoFactor: sessionProcedure
    .input(z.object({ codigo: z.string().min(6).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { twoFactorSecret: true },
      });

      if (!user.twoFactorSecret) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Comece a configuração de novo: não há segredo pendente.',
        });
      }

      if (!conferirCodigo(user.twoFactorSecret, input.codigo)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Código inválido. Confira a hora do celular e tente outro.',
        });
      }

      const codigos = gerarCodigosDeRecuperacao();

      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          twoFactorEnabledAt: new Date(),
          twoFactorRecoveryCodes: await protegerCodigos(codigos),
        },
      });

      /* Única vez que os códigos aparecem em texto: no banco só ficam os
         hashes. */
      return { codigos };
    }),

  /** Gera outros códigos — os antigos deixam de valer na hora. */
  regenerateRecoveryCodes: sessionProcedure
    .input(z.object({ codigo: z.string().min(6).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { twoFactorSecret: true, twoFactorEnabledAt: true },
      });

      if (!user.twoFactorEnabledAt || !user.twoFactorSecret) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ative a verificação primeiro.',
        });
      }

      if (!conferirCodigo(user.twoFactorSecret, input.codigo)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Código inválido.',
        });
      }

      const codigos = gerarCodigosDeRecuperacao();

      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { twoFactorRecoveryCodes: await protegerCodigos(codigos) },
      });

      return { codigos };
    }),

  /**
   * Desligar só vale para quem não é obrigado. Dono de academia e dono do
   * sistema não têm esse botão — e o servidor recusa mesmo que a tela mude.
   */
  disableTwoFactor: sessionProcedure
    .input(z.object({ codigo: z.string().min(6).max(10) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { role: true, twoFactorSecret: true },
      });

      if (exigeDoisFatores(user.role)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            'A verificação em duas etapas é obrigatória para este acesso.',
        });
      }

      if (
        !user.twoFactorSecret ||
        !conferirCodigo(user.twoFactorSecret, input.codigo)
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Código inválido.',
        });
      }

      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: {
          twoFactorSecret: null,
          twoFactorEnabledAt: null,
          twoFactorRecoveryCodes: [],
        },
      });

      return { ok: true };
    }),
  /**
   * Troca a própria senha.
   *
   * Existe aqui, e não só no perfil, porque o dono do sistema não entra na
   * área das academias — era a única conta sem como trocar a sua.
   *
   * Pede a senha atual: sessão aberta em máquina alheia não pode virar troca
   * de senha, senão o dono perde a conta sem nem saber.
   */
  changePassword: sessionProcedure
    .input(
      z.object({
        atual: z.string().min(1, 'Informe a senha atual'),
        nova: z
          .string()
          .min(8, 'A senha nova precisa de pelo menos 8 letras')
          .max(72),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({
        where: { id: ctx.session.user.id },
        select: { password: true },
      });

      if (!(await verify(user.password, input.atual))) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Senha atual incorreta.',
        });
      }

      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { password: await hash(input.nova) },
      });

      return { ok: true };
    }),
});
