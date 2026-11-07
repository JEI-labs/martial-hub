// src/server/validations/plans.ts
import { EPlanBilling } from '@prisma/client';
import { z } from 'zod';

/**
 * O valor do plano numa modalidade, em centavos e como texto — igual ao preço
 * padrão do formulário. Vazio ou zero quer dizer "usa o preço padrão".
 */
export const modalityPriceInputSchema = z.object({
  modalityId: z.string().uuid(),
  price: z.string(),
});

export type IModalityPriceInput = z.infer<typeof modalityPriceInputSchema>;

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  price: z.string().min(1, 'Preço deve ser maior que zero'),
  duration: z.string().min(1, 'Duração deve ser maior que zero'),
  billing: z.nativeEnum(EPlanBilling),
  isDefault: z.boolean(),
  /** Ausente quer dizer "não mexer" nos valores por modalidade. */
  modalityPrices: z.array(modalityPriceInputSchema).optional(),
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
  /** Ausente quer dizer "não mexer" nos valores por modalidade. */
  modalityPrices: z.array(modalityPriceInputSchema).optional(),
});

export type IUpdatePlanSchema = z.infer<typeof updatePlanSchema>;

/** O desconto da academia da 2ª modalidade em diante. */
export const pricingSettingsSchema = z.object({
  multiModalityDiscount: z
    .number()
    .int('Use um número inteiro')
    .min(0, 'O desconto não pode ser negativo')
    .max(100, 'O desconto vai até 100%'),
});

export type IPricingSettings = z.infer<typeof pricingSettingsSchema>;
