// src/server/validations/users.ts
import * as z from 'zod';

export const updateUserSchema = z
  .object({
    name: z.string().min(1, 'Nome é obrigatório'),
    email: z.string().email('Email inválido'),
    password: z
      .string()
      .min(6, 'Senha deve conter no mínimo 6 caracteres')
      .max(72, 'Senha deve ter no máximo 72 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  });

export type IUpdateUserSchema = z.infer<typeof updateUserSchema>;
