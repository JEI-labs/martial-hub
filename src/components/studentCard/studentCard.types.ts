import type { GraduationView } from '@/components/graduationBadge/graduationBadge.component';

export interface ActiveEnrollmentRow {
  id: string;
  modality: { id: string; name: string };
  planId: string;
  planName: string;
  discountPercent: number;
}

export interface StudentRow {
  id: string;
  name: string;
  avatar?: string | null;
  email: string;
  status: string;
  /** Uma por modalidade que o aluno faz hoje, na ordem da academia. */
  activeEnrollments: Array<ActiveEnrollmentRow>;
  graduation?: GraduationView | null;
  createdAt: Date;
}

export interface StudentsTableProps {
  students: Array<StudentRow>;
  onEdit: (_id: string) => void;
  onDelete: (_id: string) => void | Promise<void>;
}
