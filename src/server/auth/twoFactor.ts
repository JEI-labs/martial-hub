import 'server-only';

import { randomBytes } from 'node:crypto';
import { hash, verify } from 'argon2';
import QRCode from 'qrcode';

import { EUserRole } from '@prisma/client';

import { montarUri } from './totp';

export { conferirCodigo, gerarSegredo } from './totp';

/**
 * Quem é obrigado a ter verificação em duas etapas: só o dono do sistema.
 *
 * A conta dele não abre uma academia, abre todas — e junto o painel que cria,
 * suspende e entra como suporte em qualquer uma. Uma senha vazada aí não é um
 * cliente comprometido, é a carteira inteira. Para um punhado de contas
 * internas, exigir não cria atrito de adoção nenhum.
 */
export function exigeDoisFatores(papel: EUserRole): boolean {
  return papel === EUserRole.MASTER;
}

/**
 * Para quem ela é fortemente recomendada, sem ser exigida.
 *
 * Dono de academia: a conta abre os dados de todos os alunos e o financeiro.
 * Mas cobrar antes do primeiro acesso transformava a porta de entrada numa
 * parede, e quem chega para conhecer o sistema desiste antes de ver o
 * sistema. O lugar de insistir é a tela de segurança, onde dá para explicar
 * o porquê.
 */
export function recomendaDoisFatores(papel: EUserRole): boolean {
  return papel === EUserRole.OWNER;
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
