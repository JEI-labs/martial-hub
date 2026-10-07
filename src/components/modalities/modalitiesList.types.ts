import type { Modality } from '@prisma/client';

export interface IModalitiesList {
  modalities: Array<Modality>;
  isLoading: boolean;
  onEdit: (_modality: Modality) => void;
  /** Troca a modalidade com a vizinha: -1 sobe, 1 desce. */
  onMove: (_index: number, _direction: -1 | 1) => void;
  isMoving: boolean;
}
