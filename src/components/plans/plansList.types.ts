import type { EPlanBilling } from '@prisma/client';

export interface PlanItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration: number;
  billing: EPlanBilling;
  isDefault: boolean;
  createdAt: string | Date;
  /** Valores próprios por modalidade; as outras usam `price`. */
  modalityPrices?: Array<{
    modalityId: string;
    price: number;
    modality: { name: string };
  }>;
}

export interface IPlanList {
  plans: Array<PlanItem>;
  isLoading: boolean;
  onEdit: (_id: string) => void;
}
