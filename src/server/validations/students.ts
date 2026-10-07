import { EGraduation } from '@prisma/client';
import { z } from 'zod';

export const createStudentSchema = z.object({
  name: z.string().min(1, 'Por favor, insira um nome válido.'),
  email: z.string().email('Por favor, insira um endereço de email válido.'),
  phone: z.string().min(10, 'Por favor, insira um telefone válido'),
  planId: z.string().uuid('Selecione um plano'),
  avatarUrl: z.string().nullable(),
  // opcional: nem todo aluno novo já tem graduação definida
  graduation: z.nativeEnum(EGraduation).nullable().optional(),
  birthDate: z.string().superRefine((val, ctx) => {
    if (!val || val.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Por favor, insira uma data de nascimento',
      });
      return;
    }

    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = val.match(regex);
    if (!match) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Formato de data inválido. Use DD/MM/AAAA',
      });
      return;
    }

    const [_, day, month, year] = match;
    const parsedDate = new Date(`${year}-${month}-${day}`);

    if (isNaN(parsedDate.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida' });
      return;
    }

    const currentYear = new Date().getFullYear();
    if (parsedDate.getFullYear() > currentYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O ano de nascimento não pode ser maior que o ano atual',
      });
    }
  }),
});

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().nullable(),
  studentId: z.string().min(1, 'Por favor, insira um ID válido'),
});

export const updateStudentSchema = createStudentSchema.extend({
  id: z.string({ message: 'ID da categoria é inválido' }),
});

export type IStudentCreateTypes = z.infer<typeof createStudentSchema>;
export type IUpdateStudentTypes = z.infer<typeof updateStudentSchema>;

export const defaultCreateStudentValues = {
  name: '',
  email: '',
  phone: '',
  avatarUrl: '',
  planId: '',
  graduation: null,
  birthDate: undefined,
};
