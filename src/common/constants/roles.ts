import { EUserRole } from '@prisma/client';

/** O que cada papel faz, na linguagem de quem usa o sistema. */
export const ROLE_INFO: Record<
  EUserRole,
  { label: string; description: string }
> = {
  [EUserRole.MASTER]: {
    label: 'Sistema',
    description: 'Dono do sistema, com acesso a todas as academias.',
  },
  [EUserRole.OWNER]: {
    label: 'Dono',
    description:
      'Faz tudo: alunos, dinheiro, planos, WhatsApp, aparência e equipe.',
  },
  [EUserRole.STAFF]: {
    label: 'Recepção',
    description:
      'Alunos, matrículas, pagamentos e lançamentos. Não mexe em planos, aparência nem equipe.',
  },
  [EUserRole.TEACHER]: {
    label: 'Professor',
    description:
      'Vê os alunos e registra graduação. Não entra no financeiro nem nos cadastros.',
  },
};

/** Papéis que o dono da academia pode distribuir. */
export const ASSIGNABLE_ROLES = [
  EUserRole.OWNER,
  EUserRole.STAFF,
  EUserRole.TEACHER,
] as const;

/** Quem enxerga o quê na barra lateral. */
export const ROLE_SECTIONS: Record<EUserRole, ReadonlyArray<string>> = {
  [EUserRole.MASTER]: [
    '/painel',
    '/alunos',
    '/agenda',
    '/financeiro',
    '/cadastros',
    '/whatsapp',
  ],
  [EUserRole.OWNER]: [
    '/painel',
    '/alunos',
    '/agenda',
    '/financeiro',
    '/cadastros',
    '/whatsapp',
  ],
  /* A recepção não entra na agenda: ela é pessoal do professor, e marcar aula
     no lugar dele seria decidir o horário de outra pessoa. */
  [EUserRole.STAFF]: ['/painel', '/alunos', '/financeiro', '/whatsapp'],
  [EUserRole.TEACHER]: ['/alunos', '/agenda'],
};
