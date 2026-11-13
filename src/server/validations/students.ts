import { z } from 'zod';

import { diaDoTexto } from '@/common/utils/dia';

/** Uma matrícula pedida no cadastro: a modalidade e o plano dela. */
export const enrollmentRequestSchema = z.object({
  modalityId: z.string().uuid('Escolha a modalidade'),
  planId: z.string().uuid('Selecione um plano'),
  /** Faixa com que o aluno já chega nesta modalidade. Opcional. */
  graduationId: z.string().uuid().nullable().optional(),
});

export type IEnrollmentRequest = z.infer<typeof enrollmentRequestSchema>;

/** Os dados da pessoa, sem matrícula: o que cadastro e edição dividem. */
const studentDataSchema = z.object({
  name: z.string().min(1, 'Por favor, insira um nome válido.'),
  email: z.string().email('Por favor, insira um endereço de email válido.'),
  phone: z.string().min(10, 'Por favor, insira um telefone válido'),
  avatarUrl: z.string().nullable(),
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

/**
 * Cadastro: os dados da pessoa e ao menos uma matrícula, uma por modalidade.
 */
export const createStudentSchema = studentDataSchema.extend({
  enrollments: z
    .array(enrollmentRequestSchema)
    .min(1, 'Matricule o aluno em ao menos uma modalidade')
    .refine(
      (lista) => new Set(lista.map((e) => e.modalityId)).size === lista.length,
      'A mesma modalidade apareceu duas vezes',
    ),
});

export const updateAvatarSchema = z.object({
  avatarUrl: z.string().nullable(),
  studentId: z.string().min(1, 'Por favor, insira um ID válido'),
});

/**
 * Sem matrícula: a edição mexe só nos dados da pessoa. Matricular, trocar de
 * plano e cancelar têm ações próprias, por modalidade. (Antes a edição
 * herdava o plano obrigatório do cadastro sem ter o campo na tela.)
 */
export const updateStudentSchema = studentDataSchema.extend({
  id: z.string({ message: 'ID da categoria é inválido' }),
});

export type IStudentCreateTypes = z.infer<typeof createStudentSchema>;
export type IUpdateStudentTypes = z.infer<typeof updateStudentSchema>;

export const defaultCreateStudentValues = {
  name: '',
  email: '',
  phone: '',
  avatarUrl: '',
  enrollments: [] as Array<IEnrollmentRequest>,
  birthDate: undefined,
};

/** Uma graduação nova: a faixa, o dia em que foi dada e uma observação. */
export const awardGraduationSchema = z.object({
  studentId: z.string(),
  graduationId: z.string().uuid('Escolha a faixa'),
  /** dd/mm/aaaa; vazio é hoje. */
  awardedAt: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Use DD/MM/AAAA')
    /* A regex aceita 31/02 e 45/13: a data tem de existir. */
    .refine((texto) => diaDoTexto(texto) !== null, 'Data inválida')
    .optional()
    .or(z.literal('')),
  note: z.string().trim().max(120, 'Observação muito longa').optional(),
});

export type IAwardGraduation = z.infer<typeof awardGraduationSchema>;
