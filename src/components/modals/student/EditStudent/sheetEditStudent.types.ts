export type ISheetEditStudent = {
  isOpen: boolean;
  setIsOpen: (_isOpen: boolean) => void;
  refetch?: () => void;
  studentId: string;
};
