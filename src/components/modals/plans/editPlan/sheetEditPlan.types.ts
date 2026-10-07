export interface ISheetEditPlan {
  isOpen: boolean;
  setIsOpen: (_open: boolean) => void;
  planId: string;
  refetch?: () => void;
  /** Exclusão fica dentro do próprio drawer; a lista não tem mais menu. */
  onDelete?: () => void | Promise<void>;
}
