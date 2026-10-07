import 'server-only';

import { env } from '@/env';

/**
 * Gerência de instâncias na Evolution do próprio sistema (API v2).
 *
 * Isto é diferente da conexão que o admin cadastra à mão: aqui o servidor é
 * nosso, a apikey mestre fica no ambiente e a academia só escaneia o QR. Por
 * isso nada daqui vai para o banco do usuário além do nome da instância.
 */

export interface EvolutionQr {
  base64: string | null;
  /** Código do pareamento por número, quando a instância devolve. */
  pairingCode: string | null;
}

export type EvolutionState = 'open' | 'connecting' | 'close' | 'unknown';

export function managedEvolutionEnabled(): boolean {
  return Boolean(env.EVOLUTION_BASE_URL && env.EVOLUTION_API_KEY);
}

/** Nome da instância derivado da conexão: um número, uma instância. */
export function instanceNameFor(connectionId: string): string {
  return `gym-${connectionId}`;
}

function baseUrl(): string {
  return (env.EVOLUTION_BASE_URL ?? '').replace(/\/+$/, '');
}

async function call<T>(
  path: string,
  init: {
    method: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    timeoutMs?: number;
  } = { method: 'GET' },
): Promise<T> {
  if (!managedEvolutionEnabled()) {
    throw new Error('Evolution gerenciada não está configurada no servidor.');
  }

  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.EVOLUTION_API_KEY ?? '',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    // sem timeout, um servidor fora do ar prenderia a função até o limite
    signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
  });

  const raw = await response.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail =
      (parsed as { response?: { message?: unknown }; message?: unknown })
        ?.response?.message ?? (parsed as { message?: unknown })?.message;
    const text = Array.isArray(detail)
      ? detail.join(', ')
      : String(detail ?? raw.slice(0, 200));
    throw new Error(`Evolution respondeu ${response.status}: ${text}`);
  }

  return parsed as T;
}

/**
 * O QR vem em `qrcode` na criação e solto no connect — daí a leitura dos dois
 * formatos em vez de assumir um.
 */
function readQr(payload: unknown): EvolutionQr {
  const source =
    (payload as { qrcode?: Record<string, unknown> })?.qrcode ??
    (payload as Record<string, unknown>) ??
    {};

  const base64 = source.base64;
  const pairingCode = source.pairingCode;

  return {
    base64:
      typeof base64 === 'string' && base64.length > 0
        ? base64.startsWith('data:')
          ? base64
          : `data:image/png;base64,${base64}`
        : null,
    pairingCode: typeof pairingCode === 'string' ? pairingCode : null,
  };
}

export async function createInstance(
  name: string,
): Promise<EvolutionQr & { token: string | null }> {
  const payload = await call<unknown>('/instance/create', {
    method: 'POST',
    body: {
      instanceName: name,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    },
  });

  /* `hash` é a apikey daquela instância na v2; guardá-la evita gravar a
     chave mestra do servidor na linha de cada academia. */
  const hash = (payload as { hash?: unknown })?.hash;

  return {
    ...readQr(payload),
    token: typeof hash === 'string' && hash.length > 0 ? hash : null,
  };
}

/** QR novo de uma instância que já existe. */
export async function connectInstance(name: string): Promise<EvolutionQr> {
  const payload = await call<unknown>(
    `/instance/connect/${encodeURIComponent(name)}`,
  );
  return readQr(payload);
}

export async function connectionState(
  name: string,
  /* A listagem consulta várias conexões: com o padrão de 20s, uma VM fora do
     ar deixaria a tela inteira pendurada. */
  timeoutMs = 20_000,
): Promise<EvolutionState> {
  try {
    const payload = await call<{
      instance?: { state?: string };
      state?: string;
    }>(`/instance/connectionState/${encodeURIComponent(name)}`, {
      method: 'GET',
      timeoutMs,
    });
    const state = payload?.instance?.state ?? payload?.state;
    if (state === 'open' || state === 'connecting' || state === 'close') {
      return state;
    }
    return 'unknown';
  } catch {
    // instância ainda não criada responde 404: para a tela, é o mesmo que
    // não conectada
    return 'unknown';
  }
}

/** Número que ficou conectado, lido do JID do dono da instância. */
export async function instanceNumber(name: string): Promise<string | null> {
  try {
    const payload = await call<unknown>(
      `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`,
    );
    const list = Array.isArray(payload) ? payload : [payload];
    for (const item of list) {
      const record = item as Record<string, unknown>;
      const nested = (record.instance ?? record) as Record<string, unknown>;
      const jid = nested.ownerJid ?? nested.owner;
      if (typeof jid === 'string' && jid.includes('@')) {
        return jid.split('@')[0] ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function logoutInstance(name: string): Promise<void> {
  await call(`/instance/logout/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}

export async function deleteInstance(name: string): Promise<void> {
  await call(`/instance/delete/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  }).catch(() => undefined);
}
