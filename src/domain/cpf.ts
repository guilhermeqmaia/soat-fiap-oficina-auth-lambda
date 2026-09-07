/** Regras de CPF: normalizacao, digitos verificadores e mascaramento para log. */

/** Remove tudo que nao e digito (aceita `123.456.789-09` e `12345678909`). */
export function normalizeCpf(input: string): string {
  return input.replace(/\D/g, '');
}

function checkDigit(digits: string, weightStart: number): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    sum += Number(digits[i]) * (weightStart - i);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

/**
 * Valida um CPF pelos digitos verificadores (algoritmo da Receita Federal),
 * rejeitando tamanho diferente de 11 e sequencias repetidas (`111...`).
 */
export function isValidCpf(input: string): boolean {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const firstDigit = checkDigit(cpf.slice(0, 9), 10);
  if (firstDigit !== Number(cpf[9])) return false;

  const secondDigit = checkDigit(cpf.slice(0, 10), 11);
  return secondDigit === Number(cpf[10]);
}

/**
 * `12345678909` -> `***.***.***-09`: expoe apenas os digitos verificadores,
 * seguindo o padrao de mascaramento do monolito (mesmo formato nos dois lados
 * para a correlacao de logs — US-F3-09).
 */
export function maskCpf(input: string): string {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11) return '***';
  return `***.***.***-${cpf.slice(9)}`;
}

/** Formata para exibicao: `123.456.789-09`. */
export function formatCpf(input: string): string {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11) return input;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
