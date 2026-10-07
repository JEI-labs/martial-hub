export interface ICreateRevenues {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  refetch?: () => void;
}
