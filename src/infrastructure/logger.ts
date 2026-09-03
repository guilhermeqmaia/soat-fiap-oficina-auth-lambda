/**
 * Logs estruturados em JSON (US-F3-01/US-F3-09). O CPF nunca aparece
 * completo — mascarar nos call sites com maskCpf().
 */
export function log(message: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level: 'info', message, ...fields }));
}

export function logError(message: string, fields: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ level: 'error', message, ...fields }));
}
