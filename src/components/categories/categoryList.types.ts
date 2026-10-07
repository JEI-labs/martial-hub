import { Category } from '@prisma/client';

export interface ICategoryList {
  categories: Array<Category>;
  isLoading: boolean;
  onEdit: (_id: string) => void;
}
