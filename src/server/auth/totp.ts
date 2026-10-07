import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP (RFC 6238) escrito aqui em vez de trazer uma biblioteca.
 *
 * São trinta linhas de HMAC e base32, e o algoritmo não muda desde 2011. A
 * implementação é conferida contra os vetores de teste do próprio RFC, o que
 * dá mais garantia do que confiar na API de uma dependência nova.
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIODO = 30;
const DIGITOS = 6;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = '';

  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];

  return saida;
}

export function base32Decode(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let valor = 0;
  const bytes: Array<number> = [];

  for (const caractere of limpo) {
    const indice = ALFABETO.indexOf(caractere);
    if (indice === -1) continue;

    valor = (valor << 5) | indice;
    bits += 5;

    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/** 20 bytes é o tamanho recomendado para HMAC-SHA1. */
export function gerarSegredo(): string {
  return base32Encode(randomBytes(20));
}

function hotp(segredo: Buffer, contador: number): string {
  const bloco = Buffer.alloc(8);
  bloco.writeBigUInt64BE(BigInt(contador));

  const digest = createHmac('sha1', segredo).update(bloco).digest();
  const deslocamento = digest[digest.length - 1]! & 0x0f;

  const binario =
    ((digest[deslocamento]! & 0x7f) << 24) |
    (digest[deslocamento + 1]! << 16) |
    (digest[deslocamento + 2]! << 8) |
    digest[deslocamento + 3]!;

  return String(binario % 10 ** DIGITOS).padStart(DIGITOS, '0');
}

export function gerarCodigo(
  segredo: string,
  agora: number = Date.now(),
): string {
  return hotp(base32Decode(segredo), Math.floor(agora / 1000 / PERIODO));
}

/**
 * Confere o código aceitando um passo para trás e um para frente: relógio de
 * celular alguns segundos fora do ar é comum, e recusar o código certo por
 * isso é o jeito mais rápido de a pessoa desistir do 2FA.
 *
 * A comparação é em tempo constante — comparar com `===` vaza, pelo tempo,
 * quantos dígitos bateram.
 */
export function conferirCodigo(
  segredo: string,
  codigo: string,
  agora: number = Date.now(),
): boolean {
  const limpo = codigo.replace(/\D/g, '');
  if (limpo.length !== DIGITOS) return false;

  const bytes = base32Decode(segredo);
  if (bytes.length === 0) return false;

  const passo = Math.floor(agora / 1000 / PERIODO);
  const informado = Buffer.from(limpo);

  for (const deslocamento of [-1, 0, 1]) {
    const esperado = Buffer.from(hotp(bytes, passo + deslocamento));
    if (
      esperado.length === informado.length &&
      timingSafeEqual(esperado, informado)
    ) {
      return true;
    }
  }

  return false;
}

/** O que o aplicativo autenticador lê no QR. */
export function montarUri(
  segredo: string,
  conta: string,
  emissor: string,
): string {
  const rotulo = encodeURIComponent(`${emissor}:${conta}`);
  const parametros = new URLSearchParams({
    secret: segredo,
    issuer: emissor,
    algorithm: 'SHA1',
    digits: String(DIGITOS),
    period: String(PERIODO),
  });

  return `otpauth://totp/${rotulo}?${parametros.toString()}`;
}
