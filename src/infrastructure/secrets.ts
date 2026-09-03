import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/**
 * Segredos em runtime via AWS Secrets Manager, com cache em escopo de módulo
 * (sobrevive entre invocações do mesmo container — menos latência e custo).
 * Fallback por variável de ambiente simples para testes/execução local.
 */

const client = new SecretsManagerClient({});
const cache = new Map<string, string>();

async function fetchSecret(arn: string): Promise<string> {
  const cached = cache.get(arn);
  if (cached !== undefined) return cached;

  const out = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  const value = out.SecretString ?? '';
  cache.set(arn, value);
  return value;
}

/** Segredo de assinatura do JWT: JWT_SECRET (local) ou JWT_SECRET_ARN (nuvem). */
export async function getJwtSecret(): Promise<string> {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const arn = process.env.JWT_SECRET_ARN;
  if (!arn) throw new Error('Configure JWT_SECRET_ARN (ou JWT_SECRET para uso local)');
  return fetchSecret(arn);
}

/**
 * Connection string do banco: DATABASE_URL (local) ou DB_SECRET_ARN (nuvem).
 * O secret pode ser a string crua ou um JSON com a chave DATABASE_URL
 * (contrato do repo soat-fiap-oficina-infra-db).
 */
export async function getDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const arn = process.env.DB_SECRET_ARN;
  if (!arn) throw new Error('Configure DB_SECRET_ARN (ou DATABASE_URL para uso local)');
  const raw = await fetchSecret(arn);
  try {
    const parsed = JSON.parse(raw) as { DATABASE_URL?: string };
    return parsed.DATABASE_URL ?? raw;
  } catch {
    return raw;
  }
}
