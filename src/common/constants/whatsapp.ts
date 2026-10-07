/**
 * Números de WhatsApp por academia. Um, por enquanto — quando existir plano,
 * este valor passa a sair do plano do usuário.
 *
 * Fica em `common` porque a trava de verdade é no servidor
 * (`whatsapp.createConnection`) e a tela só precisa saber para não oferecer
 * um botão que vai dar erro.
 */
export const MAX_CONNECTIONS_PER_USER = 1;
