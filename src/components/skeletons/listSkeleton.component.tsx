import { Skeleton } from '@/components/ui/skeleton';

/**
 * Esqueleto no formato de tabela. Ocupa o mesmo espaço que a listagem vai
 * ocupar, então a página não salta quando os dados chegam — diferente do
 * spinner solto, que some e empurra tudo.
 */
export function ListSkeleton({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="bg-card shadow-card overflow-hidden rounded-2xl">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-3"
            style={{ width: index === 0 ? '28%' : '16%' }}
          />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: columns }).map((_, column) => (
            <Skeleton
              key={column}
              className="h-4"
              style={{ width: column === 0 ? '28%' : '16%' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Esqueleto dos cartões de número do topo das telas. */
export function StatsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: cards }).map((_, index) => (
        <div
          key={index}
          className="bg-card shadow-card flex flex-col gap-3 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-9" />
          </div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  );
}
