import { NextResponse } from 'next/server';

import { env } from '@/env';
import { runAutomationsForEveryone } from '@/server/whatsapp/automations';

/**
 * Rotina das mensagens automáticas, chamada de fora (cron da VM, Vercel Cron,
 * o que for). Protegida por segredo: sem ele, qualquer um na internet
 * dispararia mensagem para os alunos de todo mundo.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://seu-site/api/cron/whatsapp
 *
 * Roda de hora em hora: cada regra tem um horário e uma trava de "uma vez por
 * dia por aluno", então executar demais não duplica nada.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado no servidor.' },
      { status: 503 },
    );
  }

  const header = request.headers.get('authorization');
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const reports = await runAutomationsForEveryone();

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    reports,
  });
}
