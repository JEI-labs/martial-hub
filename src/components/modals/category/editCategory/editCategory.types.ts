export interface ISheetEditCategory {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  categoryId: string;
  refetch?: () => void;
  /** Exclusão fica dentro do próprio drawer; a lista não tem mais menu. */
  onDelete?: () => void | Promise<void>;
}
