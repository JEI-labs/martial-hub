import type { Modality } from '@prisma/client';

export interface IModalityFormModal {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  /** Sem modalidade, o modal cria; com ela, edita. */
  modality?: Modality | null;
  /** As que a academia já tem, para não sugerir o que já existe. */
  existing: Array<Modality>;
  onDelete?: () => void | Promise<void>;
}
