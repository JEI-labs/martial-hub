import {
  createTRPCRouter,
  ownerProcedure,
  protectedProcedure,
} from '@/server/api/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

/** HSL cru, que é o formato das variáveis do tema: "9 60% 50%". */
const hslTriple = z
  .string()
  .regex(/^\d{1,3} \d{1,3}% \d{1,3}%$/, 'Cor inválida')
  .nullable();

export const tenantRouter = createTRPCRouter({
  /** A academia atual, com a marca e os endereços que levam até ela. */
  getCurrent: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        branding: {
          select: { logoUrl: true, loginImageUrl: true, primaryColor: true },
        },
        domains: {
          select: { hostname: true, isPrimary: true, verifiedAt: true },
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Academia não encontrada',
      });
    }

    return tenant;
  }),

  /**
   * Nome e marca. Guardar null apaga o que havia: é assim que se volta ao
   * visual padrão do sistema sem precisar de um botão à parte.
   */
  saveBranding: ownerProcedure
    .input(
      z.object({
        name: z.string().min(2, 'Nome muito curto').max(80),
        logoUrl: z.string().url().nullable(),
        loginImageUrl: z.string().url().nullable(),
        primaryColor: hslTriple,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { tenantId } = ctx;

      await ctx.prisma.$transaction([
        ctx.prisma.tenant.update({
          where: { id: tenantId },
          data: { name: input.name },
        }),
        ctx.prisma.tenantBranding.upsert({
          where: { tenantId },
          create: {
            tenantId,
            logoUrl: input.logoUrl,
            loginImageUrl: input.loginImageUrl,
            primaryColor: input.primaryColor,
          },
          update: {
            logoUrl: input.logoUrl,
            loginImageUrl: input.loginImageUrl,
            primaryColor: input.primaryColor,
          },
        }),
      ]);

      return { ok: true };
    }),
});
