import { randomInt } from 'node:crypto';

/* Sem 0/O, 1/l/I: a senha vai ser lida numa tela e digitada em outra, às
   vezes ditada por telefone. */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/**
 * Senha temporária de uma conta recém-criada: três blocos de quatro,
 * "Xk7q-Mp3a-Rt9w". São ~70 bits — sobra para uma senha que só precisa durar
 * até o primeiro acesso, e os hífens deixam conferir bloco a bloco.
 *
 * `randomInt` e não `Math.random`: é credencial de conta master.
 */
export function gerarSenhaTemporaria(): string {
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALFABETO[randomInt(ALFABETO.length)]).join(
      '',
    ),
  ).join('-');
}
