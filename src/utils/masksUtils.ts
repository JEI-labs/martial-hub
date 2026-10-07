import VMasker from 'vanilla-masker';

// ----------------------------------- CPF Mask Functions -----------------------------------
/**
 * Aplica a máscara de CPF a uma string.
 *
 * Esta função remove todos os caracteres não numéricos da entrada e formata os dígitos para seguir o padrão de CPF: "000.000.000-00".
 * A formatação é realizada por meio de substituições com expressões regulares que inserem os pontos e o hífen nas posições apropriadas.
 * Caso a string de entrada não contenha dígitos suficientes para um CPF válido, o resultado pode não estar no formato esperado.
 *
 * @param {string} value - A string contendo o CPF, com ou sem formatação.
 * @returns {string} - O CPF formatado no padrão "000.000.000-00".
 *
 * @example
 * // Exemplo de formatação:
 * maskCPF("12345678909"); // Retorna "123.456.789-09"
 */
export const maskCPF = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  // 000.000.000-00
};

/**
 * Remove a máscara de um CPF, extraindo apenas os dígitos.
 *
 * Esta função recebe uma string que pode conter um CPF formatado com caracteres especiais
 * (como pontos e hífens) e remove todos os caracteres não numéricos, retornando somente os dígitos.
 *
 * @param {string} value - O CPF formatado que pode incluir caracteres não numéricos.
 * @returns {string} - O CPF sem máscara, composto apenas por dígitos.
 *
 * @example
 * // Exemplo: transforma "123.456.789-09" em "12345678909".
 * unmaskCPF("123.456.789-09");
 */
export const unmaskCPF = (value: string): string => {
  return value.replace(/\D/g, '');
  // 00000000000
};

// ----------------------------------- Cellphone Mask Functions -----------------------------------
/**
 * Aplica a máscara de número de celular a uma string.
 *
 * A função remove todos os caracteres não numéricos da entrada e formata os dígitos para seguir o padrão brasileiro de número de celular: "(00) 00000-0000".
 * Para isso, utiliza expressões regulares que inserem os parênteses, espaços e hífen conforme necessário. Ao final, a string é limitada a 15 caracteres,
 * garantindo que o formato seja mantido mesmo se houver dígitos extras.
 *
 * @param {string} value - A string contendo o número de celular, com ou sem formatação.
 * @returns {string} - O número de celular formatado no padrão "(00) 00000-0000".
 *
 * @example
 * // Exemplo de formatação:
 * maskCellphone("11999999999"); // Retorna "(11) 99999-9999"
 */
/**
 * Formata telefone vindo de qualquer lugar: com DDI (5544...), com 11 dígitos
 * (celular) ou 10 (fixo). Diferente de `maskCellphone`, que é máscara de
 * digitação, esta é para exibir o que já está salvo.
 */
export const formatPhone = (value: string): string => {
  const digits = (value ?? '').replace(/\D/g, '');
  const local =
    digits.length > 11 && digits.startsWith('55') ? digits.slice(2) : digits;

  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return value;
};

export const maskCellphone = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    .slice(0, 15);
  // (00) 00000-0000
};

/**
 * Remove a máscara de um número de celular, extraindo apenas os dígitos.
 *
 * Esta função recebe uma string que pode conter um número de celular formatado com caracteres especiais
 * (como parênteses, espaços ou hífens) e remove todos os caracteres não numéricos, retornando somente os dígitos.
 *
 * @param {string} value - O número de celular formatado, que pode incluir caracteres não numéricos.
 * @returns {string} - O número de celular sem formatação, composto apenas por dígitos.
 *
 * @example
 * // Exemplo: transforma "(11) 99999-9999" em "11999999999".
 * unmaskCellphone("(11) 99999-9999");
 */
export const unmaskCellphone = (value: string): string => {
  return value.replace(/\D/g, '');
  // 11999999999
};

// ----------------------------------- CEP Mask Functions -----------------------------------
/**
 * Aplica a máscara de CEP a uma string.
 *
 * Esta função remove quaisquer caracteres não numéricos da entrada e formata os dígitos para seguir o padrão de CEP: "00000-000".
 * Caso a string não contenha dígitos suficientes, o resultado pode não estar no formato esperado.
 *
 * @param {string} value - A string contendo o CEP, com ou sem formatação.
 * @returns {string} - O CEP formatado no padrão "00000-000".
 *
 * @example
 * // Exemplo de formatação de CEP:
 * maskCEP("12345678"); // Retorna "12345-678"
 */
export const maskCEP = (value: string): string => {
  return value.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
  // 00000-000
};

/**
 * Remove a máscara de um CEP, extraindo apenas os dígitos.
 *
 * Esta função recebe uma string que pode conter um CEP formatado com caracteres especiais (como traços)
 * e remove todos os caracteres não numéricos, retornando somente os dígitos.
 *
 * @param {string} value - O CEP que pode estar formatado, contendo caracteres não numéricos.
 * @returns {string} - O CEP sem formatação, composto apenas por dígitos.
 *
 * @example
 * // Exemplo: transforma "12345-678" em "12345678".
 * unmaskCEP("12345-678");
 */
export const unmaskCEP = (value: string): string => {
  return value.replace(/\D/g, '');
  // 00000000
};

// ----------------------------------- CNPJ Mask Functions -----------------------------------
/**
 * Aplica a máscara de CNPJ a uma string.
 *
 * A função remove quaisquer caracteres não numéricos da entrada e, em seguida,
 * formata a sequência de dígitos para seguir o padrão de CNPJ: "00.000.000/0000-00".
 * Essa formatação é realizada por meio de substituições com expressões regulares.
 * Caso a string de entrada não contenha dígitos suficientes, o resultado pode não estar no formato esperado.
 *
 * @param {string} value - A string que contém o CNPJ, com ou sem formatação.
 * @returns {string} - A string formatada no padrão CNPJ.
 *
 * @example
 * // Exemplo de formatação de CNPJ:
 * maskCNPJ("12345678000195"); // Retorna "12.345.678/0001-95"
 */
export const maskCNPJ = (value: string): string => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  // 00.000.000/0000-00
};

/**
 * Remove a máscara de um CNPJ, extraindo apenas os dígitos.
 *
 * Esta função recebe uma string que pode conter um CNPJ formatado com caracteres especiais (como pontos, barras e hífens)
 * e remove todos os caracteres não numéricos, retornando apenas os dígitos.
 *
 * @param {string} value - O CNPJ formatado que pode incluir caracteres não numéricos.
 * @returns {string} - O CNPJ sem máscara, contendo somente os dígitos.
 *
 * @example
 * // Exemplo: transforma "12.345.678/0001-95" em "12345678000195".
 * unmaskCNPJ("12.345.678/0001-95");
 */
export const unmaskCNPJ = (value: string): string => {
  return value.replace(/\D/g, '');
  // 00000000000000
};

// ----------------------------------- NumberFormat Mask Functions --------------------------------
/**
 * Formata um número de acordo com o padrão numérico brasileiro.
 *
 * Esta função utiliza o Intl.NumberFormat para formatar um número conforme a localidade "pt-BR".
 * Recebe um número e retorna uma string representando o valor formatado de acordo com as convenções numéricas do Brasil.
 *
 * @param {number} value - O número a ser formatado.
 * @returns {string} - O número formatado como uma string seguindo o padrão "pt-BR".
 *
 * @example
 * // Exemplo de formatação numérica:
 * maskNumberFormat(1234567.89); // Retorna "1.234.567,89"
 */
export const maskNumberFormat = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {}).format(value);
};

/**
 * Formata um valor para o padrão de moeda brasileira (BRL) com opção de mascaramento.
 *
 * Esta função recebe um valor (do tipo string ou number) e um flag booleano que define se o valor deve ser exibido.
 * Caso o valor não seja numérico (ou seja, a conversão para número resulte em NaN), a função retorna:
 * - "R$ 0,00" se o valor deve ser exibido (isVisible é true)
 * - "R$ ***" se o valor deve ser mascarado (isVisible é false)
 *
 * Para valores numéricos válidos, se isVisible for true, a função utiliza o Intl.NumberFormat para formatar o número
 * no padrão brasileiro (pt-BR) e exibi-lo como moeda (BRL). Caso isVisible seja false, a função retorna "R$ ***", ocultando o valor.
 *
 * @param {string | number} value - O valor a ser formatado, podendo ser uma string ou um número.
 * @param {boolean} isVisible - Flag que determina se o valor deve ser exibido (true) ou mascarado (false).
 * @returns {string} - O valor formatado como moeda brasileira ou uma máscara, dependendo do parâmetro isVisible.
 *
 * @example
 * // Exibe o valor formatado em reais.
 * maskBRL(1234.56, true); // Retorna "R$ 1.234,56"
 *
 * @example
 * // Oculta o valor, retornando uma máscara.
 * maskBRL(1234.56, false); // Retorna "R$ ***"
 *
 * @example
 * // Valor não numérico retorna o fallback apropriado.
 * maskBRL("abc", true); // Retorna "R$ 0,00"
 */
export const maskBRL = (value: string | number, isVisible: boolean): string => {
  const numericValue = Number(value);

  if (isNaN(numericValue)) {
    return isVisible ? 'R$ 0,00' : 'R$ ***';
  }

  return isVisible
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(numericValue)
    : 'R$ ***';
};

// ----------------------------------- Name Mask Functions -----------------------------------
/**
 * Remove todos os caracteres que não são letras ou espaços.
 *
 * Esta função recebe uma string e utiliza uma expressão regular para filtrar a entrada,
 * removendo todos os caracteres que não são letras (incluindo letras acentuadas) ou espaços.
 *
 * @param {string} value - A string de entrada que será processada.
 * @returns {string} - A string resultante contendo somente letras e espaços.
 *
 * @example
 * // Exemplo: remove números e símbolos, mantendo apenas letras e espaços.
 * maskOnlyText("Olá, Mundo! 123"); // Retorna "Olá Mundo"
 */
export const maskOnlyText = (value: string): string => {
  // normalize('NFC') junta letra + acento num código só: o teclado do macOS
  // entrega "ã" como "a" + U+0303, e o acento combinante fica fora da faixa
  // Latin-1, então era removido e "João" virava "Joao".
  // \p{L} cobre qualquer letra, em vez de só as da faixa acentuada latina.
  return value.normalize('NFC').replace(/[^\p{L}\s]/gu, '');
};

// ----------------------------------- Initials Name Mask Functions -----------------------------------
/**
 * Retorna as iniciais de um nome.
 *
 * Esta função recebe uma string contendo um nome e extrai as iniciais. Se o nome possuir apenas uma palavra,
 * a função retorna a primeira letra dessa palavra em maiúsculo. Se o nome tiver duas ou mais palavras,
 * ela retorna a concatenação da primeira letra da primeira palavra com a primeira letra da segunda palavra, ambas em maiúsculo.
 * Caso o nome seja uma string vazia ou não seja informado, a função retorna uma string vazia.
 *
 * @param {string} name - O nome do qual as iniciais serão extraídas.
 * @returns {string} - As iniciais do nome, em maiúsculo.
 *
 * @example
 * // Retorna "JS" para o nome "John Smith".
 * getInitials("John Smith");
 *
 * @example
 * // Retorna "M" para o nome "Madonna".
 * getInitials("Madonna");
 *
 * @example
 * // Retorna "" para uma string vazia.
 * getInitials("");
 */
export function getInitials(name: string): string {
  if (!name?.length) return '';

  const nameParts = name.trim().split(' ');

  if (nameParts.length === 1) {
    return nameParts[0]?.charAt(0).toUpperCase() || '';
  }
  return (
    nameParts[0]?.charAt(0).toUpperCase() +
    (nameParts[1]?.charAt(0).toUpperCase() || '')
  );
}

// ----------------------------------- Decimal Mask Functions -----------------------------------
/**
 * Masks a decimal value with an optional currency acronym.
 *
 * @param {number | string} value - The decimal value to mask. This can be either a number or a string representation of a number.
 * @param {string} [acronym='R$'] - The currency acronym to prepend or append to the masked value. Defaults to 'R$'.
 * @param {'left' | 'right'} [positionAcronym='left'] - The position of the currency acronym relative to the masked value. Defaults to 'left'.
 * @param {number} [precision=2] - The number of decimal places to include in the masked value. Defaults to 2.
 * @param {boolean} [acronymWithSpace=true] - Whether to include a space between the acronym and the masked value. Defaults to true.
 * @returns {string} - The masked value with the currency acronym.
 *
 * @example
 * const maskedValue = maskDecimalWithAcronym(1234.56, 'USD', 'right', 2, false);
 * // Output: '1.234,56USD'
 */
export const maskDecimalWithAcronym = (
  value: number | string,
  acronym = 'R$',
  positionAcronym: 'left' | 'right' = 'left',
  precision = 2,
  acronymWithSpace = true,
): string => {
  if (value === '-') {
    return value;
  }

  if (value !== 0 && !value) {
    return '';
  }
  const maskedValue = VMasker?.toMoney(Number(value), {
    precision,
    separator: ',',
  });

  const isNegative = Number(VMasker.toNumber(value)) < 0;
  if (isNegative) {
    if (positionAcronym === 'left') {
      return acronymWithSpace
        ? `${acronym} -${maskedValue}`
        : `${acronym}-${maskedValue}`;
    }
    return acronymWithSpace
      ? `-${maskedValue} ${acronym}`
      : `-${maskedValue}${acronym}`;
  }

  if (positionAcronym === 'left') {
    return acronymWithSpace
      ? `${acronym} ${maskedValue}`
      : `${acronym}${maskedValue}`;
  }
  return acronymWithSpace
    ? `${maskedValue} ${acronym}`
    : `${maskedValue}${acronym}`;
};

/**
 * Unmasks a decimal number from a formatted string representation.
 *
 * @param {string} value - The formatted decimal value to be unmasked.
 * @returns {number} - The unmasked decimal value as a number, or 0 if the input is invalid.
 *
 * @example
 * const formattedValue = '150,98';
 * const unmaskedValue = unmaskDecimal(formattedValue);
 * // Output: 15098
 */
export const unmaskDecimal = (value: string): number => {
  if (!value || typeof value !== 'string') {
    return 0;
  }
  const unmaskedValue = value.replace(/[^\d,]/g, '');
  return Number(VMasker.toNumber(unmaskedValue));
};

// ----------------------------------- Value to Cents Functions -----------------------------------
/**
 * Converte um valor monetário para centavos.
 *
 * Esta função recebe um valor que pode ser do tipo string, number ou null e converte-o para centavos.
 * Caso o valor não seja informado ou seja considerado "falsy" (por exemplo, 0, null ou undefined), a função retorna "0".
 * Para valores válidos, o valor é convertido para número, multiplicado por 100 e arredondado para o inteiro mais próximo,
 * retornando o resultado como uma string.
 *
 * @param {string | number | null} value - O valor monetário a ser convertido. Pode ser uma string, um número ou null.
 * @returns {string} - O valor convertido para centavos, representado como uma string.
 *
 * @example
 * // Retorna "1000" para o valor 10, representando 10,00 convertidos para centavos.
 * valueToCents(10);
 *
 * @example
 * // Retorna "1050" para o valor "10.5", representando 10,50 convertidos para centavos.
 * valueToCents("10.5");
 *
 * @example
 * // Retorna "0" quando o valor é null ou não é informado.
 * valueToCents(null);
 */
export const valueToCents = (value?: string | number | null) => {
  if (!value) return '0';

  return String(Math.round(Number(value) * 100));
};

// ----------------------------------- Date Mask Functions -----------------------------------
/**
 * Converte uma data no formato brasileiro "DD/MM/AAAA" para um objeto `Date`.
 *
 * Aceita strings com ou sem máscara (ex: "01012023", "01/01/2023", "01-01-2023").
 * A função não valida se a data realmente existe no calendário.
 *
 * @param {string} value - A data em string no formato brasileiro.
 * @returns {Date | null} - O objeto `Date` correspondente ou `null` se a entrada for inválida ou incompleta.
 *
 * @example
 * parseMaskedDate("01/01/2023"); // ✅ Date("2023-01-01T00:00:00.000Z")
 * parseMaskedDate("31/02/2023"); // ✅ (não valida existência real)
 * parseMaskedDate("01012023");   // ✅
 * parseMaskedDate("");           // ❌ null
 */

export const maskDate = (value: string): string => {
  if (!value) return '';

  return value
    .replace(/\D/g, '') // remove tudo que não for número
    .replace(/(\d{2})(\d)/, '$1/$2') // coloca primeira barra
    .replace(/(\d{2})(\d)/, '$1/$2') // coloca segunda barra
    .slice(0, 10); // limita a 10 caracteres
};

// ----------------------------------- Date Unmask Functions -----------------------------------
/**
 * Desformata uma data no formato brasileiro (DD/MM/AAAA).
 *
 * Esta função recebe uma string representando uma data formatada no padrão brasileiro "DD/MM/AAAA" e a desformata,
 * removendo as barras (/).
 * A desformatação é realizada utilizando expressões regulares para remover as barras (/) da string.
 *
 * @param {string} value - A string contendo a data formatada a ser desformatada.
 * @returns {string} - A data desformatada, composta apenas por dígitos.
 *
 * @example
 * // Exemplo de desformatação:
 * unmaskDate("01/01/2023"); // Retorna "01012023"
 *
 */
export const unmaskDate = (value: string): string => {
  return value.replace(/\D/g, '');
  // 0000000000
};
