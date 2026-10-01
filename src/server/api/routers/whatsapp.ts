import {
  EMessageEvent,
  EMessageStatus,
  EWhatsappProvider,
} from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { createTRPCRouter, protectedProcedure } from '../trpc';
import {
  extractPlaceholders,
  renderTemplate,
  sendWhatsappMessage,
} from '@/server/whatsapp/client';
import { MAX_CONNECTIONS_PER_USER } from '@/common/constants/whatsapp';
import { runAutomationsForTenant } from '@/server/whatsapp/automations';
import {
  connectInstance,
  connectionState,
  createInstance,
  deleteInstance,
  instanceNameFor,
  instanceNumber,
  logoutInstance,
  managedEvolutionEnabled,
} from '@/server/whatsapp/evolution';
import { env } from '@/env';

/** Eventos que a rotina dispara sozinha, na ordem em que aparecem na tela. */
const AUTOMATIC_EVENTS = [
  EMessageEvent.PAYMENT_DUE_SOON,
  EMessageEvent.PAYMENT_DUE_TODAY,
  EMessageEvent.PAYMENT_OVERDUE,
  EMessageEvent.BIRTHDAY,
] as const;

/** Conexão gerenciada: aponta para a Evolution do próprio sistema. */
function isManaged(provider: EWhatsappProvider, baseUrl: string): boolean {
  return (
    provider === EWhatsappProvider.EVOLUTION &&
    Boolean(env.EVOLUTION_BASE_URL) &&
    baseUrl.replace(/\/+$/, '') ===
      (env.EVOLUTION_BASE_URL ?? '').replace(/\/+$/, '')
  );
}

export const whatsappRouter = createTRPCRouter({
  /**
   * Nunca devolve o token: ele viaja para o cliente e ficaria visível no
   * payload da página. Só informa se já existe um salvo.
   */
  getConfig: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { tenantId } = ctx;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const config = await ctx.prisma.whatsappConfig.findFirst({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        label: true,
        provider: true,
        baseUrl: true,
        instanceId: true,
        senderNumber: true,
        isActive: true,
        token: false,
      },
    });

    return config ? { ...config, hasToken: true } : null;
  }),

  /**
   * Conexões de WhatsApp da academia.
   *
   * O dono da academia não vê provedor, URL, instância nem token: isso é do
   * servidor. Ele dá um nome, informa o número e escaneia o QR. Uma conexão é
   * "gerenciada" quando aponta para a nossa Evolution — é o que permite gerar
   * QR e ler o estado dela.
   */
  listConnections: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { tenantId } = ctx;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const rows = await ctx.prisma.whatsappConfig.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        label: true,
        provider: true,
        baseUrl: true,
        instanceId: true,
        senderNumber: true,
        isActive: true,
        createdAt: true,
      },
    });

    /* Estado vem do provedor, não do banco: o celular pode ter desconectado
       sem o sistema saber. Timeout curto para a lista não travar se a VM
       estiver fora do ar. */
    return Promise.all(
      rows.map(async (row) => {
        const managed = isManaged(row.provider, row.baseUrl);
        const state =
          managed && row.instanceId
            ? await connectionState(row.instanceId, 6_000)
            : null;
        return { ...row, managed, state };
      }),
    );
  }),

  /** Cria a conexão e já devolve o QR para escanear. */
  createConnection: protectedProcedure
    .input(
      z.object({
        label: z.string().trim().min(1, 'Dê um nome para o número').max(60),
        senderNumber: z.string().trim().min(8, 'Informe o número'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      if (!managedEvolutionEnabled()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'O servidor de WhatsApp não está configurado.',
        });
      }

      /* A primeira já entra ativa: senão o dono conecta o número e nada
         envia, sem pista do porquê. */
      const total = await ctx.prisma.whatsappConfig.count({
        where: { tenantId },
      });

      if (total >= MAX_CONNECTIONS_PER_USER) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            MAX_CONNECTIONS_PER_USER === 1
              ? 'Por enquanto é um número por academia. Remova o atual para conectar outro.'
              : `Limite de ${MAX_CONNECTIONS_PER_USER} números atingido.`,
        });
      }

      const created = await ctx.prisma.whatsappConfig.create({
        data: {
          label: input.label,
          provider: EWhatsappProvider.EVOLUTION,
          baseUrl: env.EVOLUTION_BASE_URL ?? '',
          instanceId: '',
          token: env.EVOLUTION_API_KEY ?? '',
          senderNumber: input.senderNumber,
          isActive: total === 0,
          userId,
          tenantId,
        },
        select: { id: true },
      });

      const instance = instanceNameFor(created.id);

      try {
        const qr = await createInstance(instance);
        await ctx.prisma.whatsappConfig.update({
          where: { id: created.id },
          data: {
            instanceId: instance,
            // apikey da própria instância: não espalha a chave mestra
            ...(qr.token ? { token: qr.token } : {}),
          },
        });

        return { id: created.id, qr: qr.base64, pairingCode: qr.pairingCode };
      } catch (error) {
        // sem instância no provedor, a linha órfã só confundiria a tela
        await ctx.prisma.whatsappConfig.delete({ where: { id: created.id } });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Não foi possível falar com o servidor de WhatsApp.',
        });
      }
    }),

  /** QR novo, para primeira leitura ou reconexão. */
  connectionQr: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const row = await ctx.prisma.whatsappConfig.findFirst({
        where: { id: input.id, tenantId },
        select: { instanceId: true, provider: true, baseUrl: true },
      });
      if (!row?.instanceId || !isManaged(row.provider, row.baseUrl)) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conexão não encontrada.',
        });
      }

      const qr = await connectInstance(row.instanceId);
      return { qr: qr.base64, pairingCode: qr.pairingCode };
    }),

  /**
   * Estado da conexão. Quando o celular acaba de ler o QR, guarda o número
   * que entrou — é ele que passa a valer, não o que foi digitado.
   */
  connectionState: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const row = await ctx.prisma.whatsappConfig.findFirst({
        where: { id: input.id, tenantId },
        select: {
          id: true,
          instanceId: true,
          provider: true,
          baseUrl: true,
          senderNumber: true,
        },
      });
      if (!row?.instanceId || !isManaged(row.provider, row.baseUrl)) {
        return { state: 'unknown' as const, number: row?.senderNumber ?? '' };
      }

      const state = await connectionState(row.instanceId);

      if (state === 'open') {
        const number = await instanceNumber(row.instanceId);
        if (number && number !== row.senderNumber) {
          await ctx.prisma.whatsappConfig.update({
            where: { id: row.id },
            data: { senderNumber: number },
          });
          return { state, number };
        }
      }

      return { state, number: row.senderNumber };
    }),

  /** Liga uma conexão e desliga as outras, numa transação só. */
  activateConnection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const connection = await ctx.prisma.whatsappConfig.findFirst({
        where: { id: input.id, tenantId },
        select: { id: true },
      });
      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conexão não encontrada.',
        });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.whatsappConfig.updateMany({
          where: { tenantId },
          data: { isActive: false },
        }),
        ctx.prisma.whatsappConfig.update({
          where: { id: connection.id },
          data: { isActive: true },
        }),
      ]);

      return { ok: true };
    }),

  /** Remove a conexão e, se for nossa, apaga a instância do servidor. */
  deleteConnection: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const row = await ctx.prisma.whatsappConfig.findFirst({
        where: { id: input.id, tenantId },
        select: { id: true, instanceId: true, provider: true, baseUrl: true },
      });
      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conexão não encontrada.',
        });
      }

      if (row.instanceId && isManaged(row.provider, row.baseUrl)) {
        await logoutInstance(row.instanceId);
        await deleteInstance(row.instanceId);
      }

      await ctx.prisma.whatsappConfig.delete({ where: { id: row.id } });
      return { ok: true };
    }),

  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { tenantId } = ctx;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return ctx.prisma.messageTemplate.findMany({
      where: { tenantId },
      orderBy: [{ event: 'asc' }, { createdAt: 'asc' }],
    });
  }),

  saveTemplate: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        event: z.nativeEnum(EMessageEvent),
        name: z.string().min(1, 'Informe um nome'),
        body: z.string().min(1, 'Escreva a mensagem'),
        providerTemplateName: z.string().nullable().optional(),
        providerLanguage: z.string().nullable().optional(),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      if (input.id) {
        const result = await ctx.prisma.messageTemplate.updateMany({
          where: { id: input.id, tenantId },
          data: {
            event: input.event,
            name: input.name,
            body: input.body,
            providerTemplateName: input.providerTemplateName || null,
            providerLanguage: input.providerLanguage || 'pt_BR',
            isActive: input.isActive,
          },
        });
        if (result.count === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Modelo não encontrado.',
          });
        }
        return { message: 'Modelo atualizado' };
      }

      await ctx.prisma.messageTemplate.create({
        data: {
          event: input.event,
          name: input.name,
          body: input.body,
          providerTemplateName: input.providerTemplateName || null,
          providerLanguage: input.providerLanguage || 'pt_BR',
          isActive: input.isActive,
          userId,
          tenantId,
        },
      });

      return { message: 'Modelo criado' };
    }),

  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const result = await ctx.prisma.messageTemplate.deleteMany({
        where: { id: input.id, tenantId },
      });
      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Modelo não encontrado.',
        });
      }
      return { message: 'Modelo excluído' };
    }),

  /** Envio manual, disparado pelas ações da linha do aluno. */
  /**
   * Regras de envio automático. Devolve uma linha por evento automático,
   * mesmo os que ainda não foram configurados — a tela mostra todos com o
   * padrão desligado.
   */
  listAutomations: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { tenantId } = ctx;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const [saved, templates] = await Promise.all([
      ctx.prisma.messageAutomation.findMany({ where: { tenantId } }),
      ctx.prisma.messageTemplate.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true, event: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const byEvent = new Map(saved.map((item) => [item.event, item]));

    const automations = AUTOMATIC_EVENTS.map((event) => {
      const current = byEvent.get(event);
      return {
        event,
        isActive: current?.isActive ?? false,
        offsetDays:
          current?.offsetDays ?? (event === 'PAYMENT_OVERDUE' ? 7 : 3),
        sendHour: current?.sendHour ?? 9,
        templateId: current?.templateId ?? null,
        templates: templates.filter((template) => template.event === event),
      };
    });

    return automations;
  }),

  saveAutomation: protectedProcedure
    .input(
      z.object({
        event: z.nativeEnum(EMessageEvent),
        isActive: z.boolean(),
        /** 1 a 30 dias: acima disso vira perseguição, não lembrete. */
        offsetDays: z.number().int().min(1).max(30),
        sendHour: z.number().int().min(0).max(23),
        templateId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      if (input.isActive && !input.templateId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Escolha o modelo de mensagem antes de ligar.',
        });
      }

      if (input.templateId) {
        const template = await ctx.prisma.messageTemplate.findFirst({
          where: { id: input.templateId, tenantId, event: input.event },
          select: { id: true },
        });
        if (!template) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Modelo não encontrado para este evento.',
          });
        }
      }

      const data = {
        isActive: input.isActive,
        offsetDays: input.offsetDays,
        sendHour: input.sendHour,
        templateId: input.templateId,
      };

      await ctx.prisma.messageAutomation.upsert({
        where: { tenantId_event: { tenantId, event: input.event } },
        create: { ...data, event: input.event, tenantId, userId },
        update: data,
      });

      return { ok: true };
    }),

  /** Roda a rotina agora, para conferir sem esperar o horário. */
  runAutomationsNow: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { tenantId } = ctx;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    return runAutomationsForTenant(tenantId);
  }),

  /** Histórico de envios, do mais recente para o mais antigo. */
  listLogs: protectedProcedure
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(100).default(20),
          event: z.nativeEnum(EMessageEvent).optional(),
          status: z.nativeEnum(EMessageStatus).optional(),
        })
        .default({ page: 1, limit: 20 }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const where = {
        tenantId,
        ...(input.event ? { event: input.event } : {}),
        ...(input.status ? { status: input.status } : {}),
      };

      const [logs, total, failed] = await Promise.all([
        ctx.prisma.messageLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          include: { student: { select: { id: true, name: true } } },
        }),
        ctx.prisma.messageLog.count({ where }),
        ctx.prisma.messageLog.count({
          where: { tenantId, status: EMessageStatus.FAILED },
        }),
      ]);

      return {
        data: logs,
        failed,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          totalPages: Math.ceil(total / input.limit),
        },
      };
    }),

  sendToStudent: protectedProcedure
    .input(
      z.object({
        studentId: z.string(),
        event: z.nativeEnum(EMessageEvent),
        templateId: z.string().optional(),
        /** Texto final já editado na tela; o modelo serve de ponto de partida. */
        body: z.string().min(1, 'Escreva a mensagem'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { tenantId } = ctx;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const [config, student, template] = await Promise.all([
        ctx.prisma.whatsappConfig.findFirst({
          where: { tenantId, isActive: true },
        }),
        ctx.prisma.student.findFirst({
          where: { id: input.studentId, tenantId },
          select: { id: true, name: true, phone: true },
        }),
        input.templateId
          ? ctx.prisma.messageTemplate.findFirst({
              where: { id: input.templateId, tenantId },
            })
          : Promise.resolve(null),
      ]);

      if (!student) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Aluno não encontrado.',
        });
      }
      if (!config) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Configure a integração de WhatsApp em Configurações.',
        });
      }

      const values: Record<string, string> = {
        aluno: student.name,
        primeiro_nome: student.name.split(' ')[0] ?? student.name,
      };

      const body = renderTemplate(input.body, values);

      // a Meta usa parâmetros posicionais no corpo do template, então a
      // ordem enviada tem de ser a ordem em que aparecem no texto
      const parameters = extractPlaceholders(input.body).map(
        (key) => values[key] ?? '',
      );

      const result = await sendWhatsappMessage(config, student.phone, body, {
        metaTemplateName: template?.providerTemplateName,
        metaLanguage: template?.providerLanguage,
        parameters,
      });

      // registra sucesso e falha: o histórico é o que explica um envio que
      // o aluno diz não ter recebido
      await ctx.prisma.messageLog.create({
        data: {
          event: input.event,
          body,
          status: result.ok ? 'SENT' : 'FAILED',
          error: result.error ?? null,
          toNumber: student.phone,
          studentId: student.id,
          templateId: input.templateId ?? null,
          userId,
          tenantId,
        },
      });

      if (!result.ok) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Não foi possível enviar a mensagem.',
        });
      }

      return { message: 'Mensagem enviada' };
    }),
});
