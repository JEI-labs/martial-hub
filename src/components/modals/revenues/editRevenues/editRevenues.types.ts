import { ICreateFinanceEntry } from '@/server/validations/finance';

export interface IEditRevenues {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  entry: ICreateFinanceEntry & { id: string };
  refetch?: () => void;
}
