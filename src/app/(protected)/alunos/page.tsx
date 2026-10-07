'use client';

import { useResetOnChange } from '@/hooks/useResetOnChange/useResetOnChange.hook';
import { useState } from 'react';
import { BreadcrumbUpdater } from '@/contexts/breadcrumb';
import type { StudentStatus } from '@/server/utils/studentStatus';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { api } from '@/trpc/react';
import { StudentsTable } from '@/components/studentCard/studentsTable.component';
import { ListSkeleton } from '@/components/skeletons/listSkeleton.component';
import { toast } from '@/hooks/use-toast';
import { SheetCreateStudent } from '@/components/modals/student/createStudent/sheetCreateStudent.component';
import { SheetEditStudent } from '@/components/modals/student/EditStudent/sheetEditStudent.component';
import { ListToolbar } from '@/components/listToolbar/listToolbar.component';
import { AppPagination } from '@/components/appPagination/appPagination.component';
import { useDebounce } from '@/hooks/useDebounce/useDebounce';
import { AdvancedFilterDatePicker } from '@/components/forms/advancedFilterDatePicker/advancedFilterDatePicker.component';
import { Calendar } from 'lucide-react';
import { AdvancedFilterCheckbox } from '@/components/forms/advancedFilterCheckbox/advancedFilterCheckbox.component';
import { AdvancedFilterCheckboxType } from '@/components/forms/advancedFilterCheckbox/advancedFilterCheckbox.types';

const breadcrumbItems = [
  { label: 'Home', href: '/painel' },
  { label: 'Alunos', href: '/alunos' },
];

const STATUS_OPTIONS: Array<AdvancedFilterCheckboxType> = [
  { id: 'EM DIA', label: 'Em Dia' },
  { id: 'PENDENTE', label: 'Pendente' },
  { id: 'ATRASADO', label: 'Atrasado' },
  { id: 'SEM MATRÍCULA', label: 'Sem matrícula' },
];

export default function StudentsPage() {
  const [showSheet, setShowSheet] = useState(false);
  const [showSheetEdit, setShowSheetEdit] = useState(false);
  const [dataStudentSelectedID, setDataStudentSelectedID] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);

  const [selectedStatuses, setSelectedStatuses] = useState<
    Array<StudentStatus>
  >([]);
  // Sem período pré-selecionado: a lista abre com todos os alunos, e a data
  // só entra na busca quando o professor escolher um intervalo.
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const studentsApi = api.student.getAll.useQuery(
    {
      page,
      limit,
      search: debouncedSearch || undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    },
    { staleTime: 5000 },
  );

  const deleteStudentApi = api.student.delete.useMutation({
    onSuccess: () => {
      studentsApi.refetch();
    },
    onError: (error) => {
      toast({
        title: 'Erro ao deletar aluno',
        description: error.message,
      });
    },
  });

  const { data: studentsData, isLoading } = studentsApi;

  // sempre volta à página 1 ao mudar filtros
  useResetOnChange(
    [debouncedSearch, selectedStatuses, dateFrom, dateTo, limit],
    () => setPage(1),
  );

  const handleDeleteStudent = async (studentId: string) => {
    await deleteStudentApi.mutateAsync({ id: studentId });
    toast({
      title: 'Sucesso',
      description: 'Aluno deletado com sucesso',
    });
  };

  const handleEditStudent = (studentId: string) => {
    setDataStudentSelectedID(studentId);
    setShowSheetEdit(true);
  };

  return (
    <div className="w-full">
      <BreadcrumbUpdater items={breadcrumbItems} />

      <main className="flex flex-col gap-4">
        <ListToolbar
          searchPlaceholder="Buscar alunos..."
          onSearch={setSearchTerm}
          total={studentsData?.pagination.total}
          totalLabel={['aluno', 'alunos']}
          action={
            <Button onClick={() => setShowSheet(true)}>
              <Plus className="mr-2 size-4" />
              Adicionar aluno
            </Button>
          }
          filters={
            <>
              <AdvancedFilterDatePicker
                title="Buscar datas"
                onChange={({ from, to }) => {
                  setDateFrom(from ? from.toISOString() : '');
                  setDateTo(to ? to.toISOString() : '');
                }}
                description="Data de criação dos alunos"
                numberOfMonths={1}
                showDeleteButton={false}
                rightIcon={<Calendar />}
              />

              <AdvancedFilterCheckbox
                title="Status"
                description="Filtrar por status"
                options={STATUS_OPTIONS}
                defaultValue={selectedStatuses.map((status) => ({
                  id: status,
                  label:
                    STATUS_OPTIONS.find((o) => o.id === status)?.label ||
                    status,
                }))}
                onDelete={() => setSelectedStatuses([])}
                onChange={(next) => {
                  setSelectedStatuses(
                    next.map((item) => item.id as StudentStatus),
                  );
                }}
                showCounterIndicator
                showDeleteButton={false}
              />
            </>
          }
        />

        {isLoading ? (
          <ListSkeleton columns={5} />
        ) : (
          <>
            <div className="mt-4">
              <StudentsTable
                students={studentsData?.data ?? []}
                onEdit={handleEditStudent}
                onDelete={handleDeleteStudent}
              />
            </div>

            {(studentsData?.pagination.total ?? 0) > 0 && (
              <div className="w-full">
                <AppPagination
                  totalItems={studentsData?.pagination.total ?? 0}
                  itemsPerPage={limit}
                  currentPage={page}
                  onPageChange={setPage}
                  onItemsPerPageChange={setLimit}
                />
              </div>
            )}
          </>
        )}

        {showSheetEdit && (
          <SheetEditStudent
            isOpen={showSheetEdit}
            setIsOpen={setShowSheetEdit}
            refetch={studentsApi.refetch}
            studentId={dataStudentSelectedID}
          />
        )}

        {showSheet && (
          <SheetCreateStudent
            isOpen={showSheet}
            setIsOpen={setShowSheet}
            refetch={studentsApi.refetch}
          />
        )}
      </main>
    </div>
  );
}
