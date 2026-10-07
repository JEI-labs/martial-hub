// server/validations/finance.ts
import { z } from 'zod';

export const createFinanceEntrySchema = z.object({
  date: z
    .string()
    .nonempty('A data é obrigatória')
    .regex(
      /^([0-2]\d|3[0-1])\/(0\d|1[0-2])\/\d{4}$/,
      'Formato da data deve ser DD/MM/AAAA',
    ),

  amount: z.string().nonempty('O valor é obrigatório'),

  type: z.enum(['INCOME', 'EXPENSE'], {
    error: 'O tipo é obrigatório',
  }),

  status: z
    .enum(['PENDING', 'PAID', 'CANCELLED'])
    .optional()
    .default('PENDING'),

  paymentMethod: z.preprocess(
    (val) => {
      if (typeof val === 'string' && val.trim() === '') {
        return undefined;
      }
      return val;
    },
    z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'PIX', 'BOLETO'], {
      error: 'Método de pagamento é obrigatório',
    }),
  ),

  currency: z
    .string()
    .length(3, 'A moeda deve ter 3 caracteres (ex: BRL)')
    .optional()
    .default('BRL'),

  category: z
    .string()
    .nonempty('A categoria é obrigatória')
    .max(50, 'A categoria pode ter no máximo 50 caracteres'),

  referenceId: z
    .string()
    .max(100, 'A referência pode ter no máximo 100 caracteres')
    .optional(),

  description: z
    .string()
    .max(200, 'A descrição pode ter no máximo 200 caracteres')
    .optional(),
});

export type ICreateFinanceEntry = z.infer<typeof createFinanceEntrySchema>;

/** Pre-validation shape the form actually holds (`.default()`/`.preprocess()` make it differ). */
export type ICreateFinanceEntryInput = z.input<typeof createFinanceEntrySchema>;

export const defaultCreateFinanceEntryValues: ICreateFinanceEntry = {
  date: '',
  amount: '0',
  type: 'INCOME',
  status: 'PENDING',
  paymentMethod: 'CASH',
  currency: 'BRL',
  category: '',
  referenceId: '',
  description: '',
};
