// src/server/validations/plans.ts
import { EPlanBilling } from '@prisma/client';
import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  price: z.string().min(1, 'Preço deve ser maior que zero'),
  duration: z.string().min(1, 'Duração deve ser maior que zero'),
  billing: z.nativeEnum(EPlanBilling),
  isDefault: z.boolean(),
});

export type ICreatePlanSchema = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  price: z.string().min(0, 'Preço deve ser positivo'),
  duration: z.string().min(1, 'Duração deve ser no mínimo 1 mês'),
  billing: z.nativeEnum(EPlanBilling),
  isDefault: z.boolean(),
});

export type IUpdatePlanSchema = z.infer<typeof updatePlanSchema>;
