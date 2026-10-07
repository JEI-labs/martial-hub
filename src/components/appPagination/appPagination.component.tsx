import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AppPaginationProps } from './appPagination.types';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';

export function AppPagination({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
}: AppPaginationProps) {
  const itemsPerPageLabel = 'Itens';
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex items-center gap-1 text-xs font-medium md:text-sm">
        <span className="border-input bg-background flex h-7 min-w-7 items-center justify-center rounded-md border px-1 md:h-8 md:min-w-8">
          {currentPage}
        </span>
        <span className="text-muted-foreground">de</span>
        <span className="border-input bg-background flex h-7 min-w-7 items-center justify-center rounded-md border px-1 md:h-8 md:min-w-8">
          {totalPages}
        </span>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-muted-foreground text-xs md:text-sm">
              {itemsPerPageLabel}
            </span>
            <Select
              onValueChange={(value) => onItemsPerPageChange(Number(value))}
              defaultValue={String(itemsPerPage)}
            >
              <SelectTrigger className="h-7 w-[60px] rounded border px-2 py-0 text-xs md:h-8 md:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {itemsPerPageOptions.map((option) => (
                  <SelectItem
                    key={option}
                    value={String(option)}
                    className="text-xs md:text-sm"
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Pagination className="mx-0 w-auto">
          <PaginationContent className="flex items-center">
            <PaginationItem>
              <PaginationPrevious
                href="#"
                className="h-7 md:h-8"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) onPageChange(currentPage - 1);
                }}
                aria-disabled={currentPage === 1}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                className="h-7 md:h-8"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) onPageChange(currentPage + 1);
                }}
                aria-disabled={currentPage === totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
