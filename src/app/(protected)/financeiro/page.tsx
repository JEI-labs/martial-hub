import { redirect } from 'next/navigation';

/** A seção abre na primeira aba. */
export default function FinancialPage() {
  redirect('/financeiro/resumo');
}
