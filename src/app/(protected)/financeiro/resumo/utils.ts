import { AdvancedFilterCheckboxType } from '@/components/forms/advancedFilterCheckbox/advancedFilterCheckbox.types';

export const TYPE_OPTIONS: Array<AdvancedFilterCheckboxType> = [
  { id: 'INCOME', label: 'Receita' },
  { id: 'EXPENSE', label: 'Despesa' },
  { id: 'STUDENTS', label: 'Alunos' },
];

export const STATUS_OPTIONS: Array<AdvancedFilterCheckboxType> = [
  { id: 'PAID', label: 'Pago' },
  { id: 'PENDING', label: 'Pendente' },
];
