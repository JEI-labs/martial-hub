import { EDiscountType } from '@prisma/client';
import { z } from 'zod';

export const createPromotionSchema = z
  .object({
    name: z.string().min(1, 'Informe um nome'),
    description: z.string().nullable().optional(),
    discountType: z.nativeEnum(EDiscountType),
    discountValue: z.coerce
      .number()
      .positive('O desconto deve ser maior que zero'),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) =>
      data.discountType !== EDiscountType.PERCENTAGE ||
      data.discountValue <= 100,
    { message: 'Percentual não pode passar de 100', path: ['discountValue'] },
  );

export const updatePromotionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Informe um nome'),
  description: z.string().nullable().optional(),
  discountType: z.nativeEnum(EDiscountType),
  discountValue: z.coerce.number().positive(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  isActive: z.boolean(),
});

export type ICreatePromotion = z.infer<typeof createPromotionSchema>;
export type ICreatePromotionInput = z.input<typeof createPromotionSchema>;
export type IUpdatePromotion = z.infer<typeof updatePromotionSchema>;

export const defaultPromotionValues: ICreatePromotionInput = {
  name: '',
  description: '',
  discountType: EDiscountType.PERCENTAGE,
  discountValue: 0,
  startsAt: null,
  endsAt: null,
  isActive: true,
};
