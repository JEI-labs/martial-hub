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
}

export interface IPlanList {
  plans: Array<PlanItem>;
  isLoading: boolean;
  onEdit: (_id: string) => void;
}
