import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * Leitura de segredos do AWS Secrets Manager com cache no escopo do container
 * (a Lambda reaproveita o valor entre invocacoes, evitando chamada por request).
 *
 * O secret pode guardar um valor em texto puro ou um JSON — nesse caso o valor
 * e extraido pela chave informada (ex.: `JWT_SECRET`, ou as chaves padrao de um
 * secret gerado pelo RDS).
 */
export interface SecretsReader {
  getSecretString(secretId: string): Promise<string>;
}

export class SecretsManagerReader implements SecretsReader {
  private readonly cache = new Map<string, string>();

  constructor(private readonly client: SecretsManagerClient = new SecretsManagerClient({})) {}

  async getSecretString(secretId: string): Promise<string> {
    const cached = this.cache.get(secretId);
    if (cached !== undefined) return cached;

    const response = await this.client.send(new GetSecretValueCommand({ SecretId: secretId }));
    const value =
      response.SecretString ??
      (response.SecretBinary ? Buffer.from(response.SecretBinary).toString('utf8') : undefined);

    if (!value) {
      throw new Error(`Secret "${secretId}" nao possui valor.`);
    }

    this.cache.set(secretId, value);
    return value;
  }
}

/** Extrai `key` quando o secret e um JSON; caso contrario devolve o texto. */
export function extractSecretValue(secretString: string, key: string): string {
  const trimmed = secretString.trim();
  if (!trimmed.startsWith('{')) return trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
  if (typeof parsed !== 'object' || parsed === null) return trimmed;

  const value = (parsed as Record<string, unknown>)[key];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Secret JSON nao possui a chave "${key}".`);
  }
  return value;
}

/**
 * Monta a connection string do Postgres a partir de um secret. Aceita tanto
 * `{ "DATABASE_URL": "postgresql://..." }` quanto o formato gerado pelo RDS
 * (`{ username, password, host, port, dbname }`).
 */
export function buildDatabaseUrl(secretString: string): string {
  const trimmed = secretString.trim();
  if (!trimmed.startsWith('{')) return trimmed;

  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  const direct = parsed['DATABASE_URL'] ?? parsed['databaseUrl'] ?? parsed['url'];
  if (typeof direct === 'string' && direct !== '') return direct;

  const username = String(parsed['username'] ?? parsed['user'] ?? '');
  const password = String(parsed['password'] ?? '');
  const host = String(parsed['host'] ?? '');
  const port = String(parsed['port'] ?? 5432);
  const database = String(parsed['dbname'] ?? parsed['database'] ?? 'postgres');
  const schema = String(parsed['schema'] ?? 'public');

  if (!username || !host) {
    throw new Error('Secret do banco sem DATABASE_URL nem host/username.');
  }

  const credentials = `${encodeURIComponent(username)}:${encodeURIComponent(password)}`;
  return `postgresql://${credentials}@${host}:${port}/${database}?schema=${schema}`;
}
