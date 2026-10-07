export interface ICreateSheetCategory {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  refetch?: () => void;
}
