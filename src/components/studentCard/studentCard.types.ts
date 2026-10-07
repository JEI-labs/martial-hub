import type { EGraduation } from '@prisma/client';

export interface StudentRow {
  id: string;
  name: string;
  avatar?: string | null;
  email: string;
  status: string;
  planName: string;
  planId?: string | null;
  graduation?: EGraduation | null;
  createdAt: Date;
}

export interface StudentsTableProps {
  students: Array<StudentRow>;
  onEdit: (_id: string) => void;
  onDelete: (_id: string) => void | Promise<void>;
}
