import { Supplier } from '@prisma/client';

export interface ISupplierList {
  suppliers: Array<Supplier>;
  isLoading: boolean;
  onEdit: (_id: string) => void;
}
