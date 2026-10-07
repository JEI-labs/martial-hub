import { redirect } from 'next/navigation';

/** A seção abre na primeira aba. */
export default function RegistrationsPage() {
  redirect('/cadastros/planos');
}
