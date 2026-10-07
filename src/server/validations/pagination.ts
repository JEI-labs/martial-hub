import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
});

export const getAllStudentInputSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1),
  search: z.string().optional(),
  status: z
    .array(z.enum(['EM DIA', 'PENDENTE', 'ATRASADO', 'SEM MATRÍCULA']))
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
