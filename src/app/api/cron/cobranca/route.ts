import { NextResponse, type NextRequest } from 'next/server';

import { env } from '@/env';
import { aplicarRegraDeCobranca } from '@/server/billing/invoices';

/**
 * A régua de cobrança rodando sozinha.
 *
 * Ela também roda quando alguém abre uma tela, mas academia inadimplente
 * costuma ser justamente a que parou de abrir o sistema — sem este cron, o
 * bloqueio só aconteceria no dia em que o dono resolvesse entrar.
 *
 * Mesmo segredo do cron das mensagens, no mesmo crontab da VM.
 */
export async function GET(request: NextRequest) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado.' },
      { status: 503 },
    );
  }

  const autorizacao = request.headers.get('authorization');
  if (autorizacao !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const resultado = await aplicarRegraDeCobranca();

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    vencidas: resultado.vencidas,
    bloqueadas: resultado.bloqueadas.map((tenant) => tenant.name),
  });
}
