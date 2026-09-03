/**
 * Validação de CPF (dígitos verificadores) — lógica de domínio pura,
 * sem dependência de AWS ou banco.
 */

/** Remove tudo que não é dígito (aceita "111.444.777-35" e "11144477735"). */
export function normalizeCpf(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** Valida os dois dígitos verificadores do CPF. */
export function isValidCpf(raw: string): boolean {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // 111.111.111-11 etc.

  const digits = cpf.split('').map(Number);
  for (const position of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < position; i++) {
      sum += digits[i] * (position + 1 - i);
    }
    const expected = ((sum * 10) % 11) % 10;
    if (digits[position] !== expected) return false;
  }
  return true;
}

/** Mascara o CPF para logs: mantém apenas os 2 dígitos verificadores. */
export function maskCpf(raw: string): string {
  const cpf = normalizeCpf(raw);
  if (cpf.length !== 11) return '***';
  return `***.***.***-${cpf.slice(9)}`;
}
