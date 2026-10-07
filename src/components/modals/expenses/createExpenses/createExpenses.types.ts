export interface ICreateExpenses {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  refetch?: () => void;
}
