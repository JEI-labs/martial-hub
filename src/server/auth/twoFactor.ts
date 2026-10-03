import 'server-only';

import { randomBytes } from 'node:crypto';
import { hash, verify } from 'argon2';
import QRCode from 'qrcode';

import { EUserRole } from '@prisma/client';

import { montarUri } from './totp';

export { conferirCodigo, gerarSegredo } from './totp';

/**
 * Para quem a verificação em duas etapas é fortemente recomendada.
 *
 * Dono de academia e dono do sistema: são as contas que abrem o dado de todo
 * mundo — alunos, dinheiro, e no caso do master, de todas as academias.
 *
 * Recomendada, e não exigida: trancar a porta de quem ainda não configurou
 * transformava o primeiro acesso numa parede, e quem chega para conhecer o
 * sistema desiste antes de ver o sistema. O lugar de insistir é a tela de
 * segurança, onde dá para explicar o porquê.
 */
export function recomendaDoisFatores(papel: EUserRole): boolean {
  return papel === EUserRole.OWNER || papel === EUserRole.MASTER;
}

export async function gerarQrCode(
  segredo: string,
  conta: string,
  emissor: string,
): Promise<{ uri: string; qr: string }> {
  const uri = montarUri(segredo, conta, emissor);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });

  return { uri, qr };
}

/**
 * Códigos de recuperação: oito, de uso único, guardados como hash.
 *
 * Quem perde o celular precisa de uma porta, e essa porta não pode ficar
 * legível no banco — um vazamento do banco entregaria o segundo fator junto
 * com o primeiro.
 */
export function gerarCodigosDeRecuperacao(): Array<string> {
  return Array.from({ length: 8 }).map(() => {
    const bruto = randomBytes(5).toString('hex').toUpperCase();
    return `${bruto.slice(0, 5)}-${bruto.slice(5)}`;
  });
}

export async function protegerCodigos(
  codigos: Array<string>,
): Promise<Array<string>> {
  return Promise.all(codigos.map((codigo) => hash(codigo)));
}

/**
 * Confere um código de recuperação e devolve a lista sem ele. Usar uma vez é
 * o que separa um código de recuperação de uma segunda senha.
 */
export async function usarCodigoDeRecuperacao(
  guardados: Array<string>,
  informado: string,
): Promise<{ ok: boolean; restantes: Array<string> }> {
  const limpo = informado.trim().toUpperCase();

  for (const guardado of guardados) {
    try {
      if (await verify(guardado, limpo)) {
        return {
          ok: true,
          restantes: guardados.filter((item) => item !== guardado),
        };
      }
    } catch {
      // hash estragado no banco não pode derrubar o login
    }
  }

  return { ok: false, restantes: guardados };
}

/** Se a conta já configurou a segunda etapa. */
export async function temDoisFatores(userId: string): Promise<boolean> {
  const { prisma } = await import('@/server/db');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorEnabledAt: true },
  });

  return Boolean(user?.twoFactorEnabledAt);
}
