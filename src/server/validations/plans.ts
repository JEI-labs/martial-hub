// src/server/validations/plans.ts
import { EPlanBilling } from '@prisma/client';
import { z } from 'zod';

/**
 * O valor do plano numa modalidade, em centavos e como texto — igual ao preço
 * padrão do formulário. Vazio ou zero quer dizer "usa o preço padrão".
 */
export const modalityPriceInputSchema = z.object({
  modalityId: z.string().uuid(),
  /* Só dígitos: "abc" e "-100" eram lidos como "usa o padrão" e apagavam o
     valor da modalidade, em vez de serem recusados. */
  price: z.string().regex(/^\d*$/, 'Valor inválido'),
});

/** Uma entrada por modalidade: repetida, o banco recusava com um 500. */
const modalityPricesSchema = z
  .array(modalityPriceInputSchema)
  .refine(
    (lista) => new Set(lista.map((i) => i.modalityId)).size === lista.length,
    'Modalidade repetida nos valores por modalidade.',
  );

export type IModalityPriceInput = z.infer<typeof modalityPriceInputSchema>;

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  price: z.string().min(1, 'Preço deve ser maior que zero'),
  duration: z.string().min(1, 'Duração deve ser maior que zero'),
  billing: z.nativeEnum(EPlanBilling),
  isDefault: z.boolean(),
  /** Ausente quer dizer "não mexer" nos valores por modalidade. */
  modalityPrices: modalityPricesSchema.optional(),
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
  /** Desativado sai das escolhas novas. Ausente quer dizer "não mexer". */
  isActive: z.boolean().optional(),
  /** Ausente quer dizer "não mexer" nos valores por modalidade. Presente,
   *  só as modalidades listadas mudam; vazio na lista volta ao padrão. */
  modalityPrices: modalityPricesSchema.optional(),
});

export type IUpdatePlanSchema = z.infer<typeof updatePlanSchema>;

/** O desconto da academia da 2ª modalidade em diante. */
export const pricingSettingsSchema = z.object({
  multiModalityDiscount: z
    .number()
    .int('Use um número inteiro')
    .min(0, 'O desconto não pode ser negativo')
    /* 100% gerava matrícula, parcelas e lançamentos de R$ 0 — e o aluno
       aparecia como atrasado por R$ 0,00 quando elas venciam. */
    .max(99, 'O desconto vai até 99%'),
});

export type IPricingSettings = z.infer<typeof pricingSettingsSchema>;
