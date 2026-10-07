import 'server-only';

import type { EWhatsappProvider, WhatsappConfig } from '@prisma/client';

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** Versão da Graph API usada quando o provedor é a Meta. */
export const META_API_VERSION = 'v21.0';

/** Deixa só dígitos e garante o DDI 55. */
export function normalizeNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

/**
 * Substitui {{campo}} pelos valores. Placeholder sem valor vira string vazia
 * em vez de aparecer cru na mensagem do aluno.
 */
export function renderTemplate(
  body: string,
  values: Record<string, string | undefined>,
): string {
  return body.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key: string) =>
    (values[key] ?? '').toString(),
  );
}

/**
 * Ordem em que os placeholders aparecem no texto. A Meta não aceita
 * parâmetros nomeados no corpo: são posicionais ({{1}}, {{2}}), então a
 * ordem local precisa bater com a do template aprovado.
 */
export function extractPlaceholders(body: string): Array<string> {
  const found = body.matchAll(/\{\{\s*([\w]+)\s*\}\}/g);
  const seen: Array<string> = [];
  for (const match of found) {
    const key = match[1];
    if (key && !seen.includes(key)) seen.push(key);
  }
  return seen;
}

export interface SendOptions {
  /** Nome do template aprovado na Meta. Sem ele, vai como texto livre. */
  metaTemplateName?: string | null;
  metaLanguage?: string | null;
  /** Valores dos placeholders, na ordem em que aparecem no corpo. */
  parameters?: Array<string>;
}

interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

function buildRequest(
  provider: EWhatsappProvider,
  config: WhatsappConfig,
  to: string,
  message: string,
  options: SendOptions,
): ProviderRequest {
  const base = config.baseUrl.replace(/\/+$/, '');

  if (provider === 'META') {
    // instanceId guarda o Phone Number ID — é ele que endereça o envio,
    // não o número em si
    const url = `${base}/${config.instanceId ?? ''}/messages`;
    const headers = {
      ...jsonHeaders,
      Authorization: `Bearer ${config.token}`,
    };

    if (options.metaTemplateName) {
      return {
        url,
        headers,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: options.metaTemplateName,
            language: { code: options.metaLanguage ?? 'pt_BR' },
            ...(options.parameters?.length
              ? {
                  components: [
                    {
                      type: 'body',
                      parameters: options.parameters.map((text) => ({
                        type: 'text',
                        text,
                      })),
                    },
                  ],
                }
              : {}),
          },
        }),
      };
    }

    // texto livre: a Meta só entrega dentro da janela de 24h desde a última
    // mensagem do aluno
    return {
      url,
      headers,
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    };
  }

  if (provider === 'ZAPI') {
    return {
      url: `${base}/send-text`,
      headers: { ...jsonHeaders, 'Client-Token': config.token },
      body: JSON.stringify({ phone: to, message }),
    };
  }

  // EVOLUTION
  return {
    url: `${base}/message/sendText/${config.instanceId ?? ''}`,
    headers: { ...jsonHeaders, apikey: config.token },
    body: JSON.stringify({ number: to, text: message }),
  };
}

/** Extrai a mensagem de erro da Meta, que vem aninhada. */
function describeError(status: number, raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; error_user_msg?: string };
    };
    const detail = parsed.error?.error_user_msg ?? parsed.error?.message;
    if (detail) return detail;
  } catch {
    // resposta não-JSON: cai no texto cru abaixo
  }
  return `Provedor respondeu ${status}. ${raw.slice(0, 200)}`;
}

export async function sendWhatsappMessage(
  config: WhatsappConfig,
  rawNumber: string,
  message: string,
  options: SendOptions = {},
): Promise<SendResult> {
  if (!config.isActive) {
    return { ok: false, error: 'Integração de WhatsApp desativada.' };
  }

  const to = normalizeNumber(rawNumber);
  if (!to) return { ok: false, error: 'Aluno sem telefone válido.' };

  const request = buildRequest(config.provider, config, to, message, options);

  try {
    // timeout explícito: sem ele um provedor fora do ar prenderia a
    // requisição até o limite da função serverless
    const response = await fetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, error: describeError(response.status, detail) };
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Falha ao contatar o provedor.';
    return { ok: false, error: message };
  }
}
