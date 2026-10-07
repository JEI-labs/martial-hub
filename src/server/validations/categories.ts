// server/validations/categories.ts
import { ECategoryStatus } from '@prisma/client';
import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(50),
  description: z.string().nullable(),
  status: z.nativeEnum(ECategoryStatus).default(ECategoryStatus.ACTIVE),
});

export type ICreateCategory = z.infer<typeof createCategorySchema>;

/** Pre-validation shape the form actually holds (`status` is defaulted). */
export type ICreateCategoryInput = z.input<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Nome é obrigatório').max(50),
  description: z.string().nullable(),
  status: z.nativeEnum(ECategoryStatus, {
    error: 'Status é obrigatório',
  }),
});

export type IUpdateCategory = z.infer<typeof updateCategorySchema>;
