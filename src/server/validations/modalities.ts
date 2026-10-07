import { z } from 'zod';

const name = z
  .string()
  .trim()
  .min(1, 'Nome é obrigatório')
  .max(50, 'Nome muito longo');

export const createModalitySchema = z.object({ name });

export type ICreateModalitySchema = z.infer<typeof createModalitySchema>;

export const updateModalitySchema = z.object({
  id: z.string().uuid(),
  name,
  isActive: z.boolean(),
});

export type IUpdateModalitySchema = z.infer<typeof updateModalitySchema>;

/** Os ids de todas as modalidades da academia, já na ordem nova. */
export const reorderModalitiesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

/** O que o formulário edita: o mesmo da atualização, sem o id. */
export const modalityFormSchema = updateModalitySchema.omit({ id: true });

export type IModalityFormSchema = z.infer<typeof modalityFormSchema>;
