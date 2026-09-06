/**
 * Configuracao lida do ambiente. Tudo que muda entre contas AWS / ambientes
 * (homolog, producao) entra aqui — nada de valor sensivel hardcoded.
 */
export interface Config {
  /** Nome/ARN do secret com o segredo de assinatura do JWT (AWS Secrets Manager). */
  jwtSecretId?: string;
  /** Segredo de assinatura em texto — usado apenas em execucao local/testes. */
  jwtSecret?: string;
  /** Chave JSON de onde extrair o segredo quando o secret guarda um objeto. */
  jwtSecretJsonKey: string;
  jwtIssuer: string;
  jwtAudience?: string;
  jwtExpiresIn: string;

  /** Nome/ARN do secret com a connection string / credenciais do banco. */
  dbSecretId?: string;
  /** Connection string do Postgres — usada em execucao local/testes. */
  databaseUrl?: string;
  dbSsl: boolean;
  dbConnectionTimeoutMs: number;
  dbQueryTimeoutMs: number;

  /** Tabela e colunas do cliente (o monolito da Fase 2 usa `cliente.cpf_cnpj`). */
  clienteTable: string;
  clienteCpfColumn: string;
  clienteIdColumn: string;
  clienteNomeColumn: string;
  /**
   * Coluna opcional de status/atividade do cliente. Vazio => todo cliente
   * encontrado e considerado ativo (o schema atual da Fase 2 nao tem a coluna).
   */
  clienteStatusColumn?: string;
  /** Valores da coluna de status que representam um cliente ativo. */
  clienteStatusAtivoValues: string[];

  /** Role emitida no token para clientes autenticados por CPF. */
  clienteRole: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : undefined;
}

function required(name: string, fallback: string): string {
  return optional(name) ?? fallback;
}

function numberFrom(name: string, fallback: number): number {
  const raw = optional(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} deve ser um numero positivo (recebido: ${raw})`);
  }
  return parsed;
}

function booleanFrom(name: string, fallback: boolean): boolean {
  const raw = optional(name)?.toLowerCase();
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Identificador SQL seguro (evita injecao via nome de tabela/coluna). */
function identifier(name: string, value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`${name} deve ser um identificador SQL valido (recebido: ${value})`);
  }
  return value;
}

export function loadConfig(): Config {
  const logLevel = required('LOG_LEVEL', 'info') as Config['logLevel'];
  const config: Config = {
    jwtSecretJsonKey: required('JWT_SECRET_JSON_KEY', 'JWT_SECRET'),
    jwtIssuer: required('JWT_ISSUER', 'oficina-auth-lambda'),
    jwtExpiresIn: required('JWT_EXPIRES_IN', '1h'),

    dbSsl: booleanFrom('DB_SSL', true),
    dbConnectionTimeoutMs: numberFrom('DB_CONNECTION_TIMEOUT_MS', 5000),
    dbQueryTimeoutMs: numberFrom('DB_QUERY_TIMEOUT_MS', 5000),

    clienteTable: identifier('CLIENTE_TABLE', required('CLIENTE_TABLE', 'cliente')),
    clienteCpfColumn: identifier('CLIENTE_CPF_COLUMN', required('CLIENTE_CPF_COLUMN', 'cpf_cnpj')),
    clienteIdColumn: identifier('CLIENTE_ID_COLUMN', required('CLIENTE_ID_COLUMN', 'id')),
    clienteNomeColumn: identifier('CLIENTE_NOME_COLUMN', required('CLIENTE_NOME_COLUMN', 'nome')),
    clienteStatusAtivoValues: required('CLIENTE_STATUS_ATIVO_VALUES', 'true,t,1,ativo,active')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value !== ''),

    clienteRole: required('CLIENTE_ROLE', 'CLIENTE'),
    logLevel: ['debug', 'info', 'warn', 'error'].includes(logLevel) ? logLevel : 'info',
  };

  const jwtSecretId = optional('JWT_SECRET_ID');
  if (jwtSecretId) config.jwtSecretId = jwtSecretId;
  const jwtSecret = optional('JWT_SECRET');
  if (jwtSecret) config.jwtSecret = jwtSecret;
  const jwtAudience = optional('JWT_AUDIENCE');
  if (jwtAudience) config.jwtAudience = jwtAudience;
  const dbSecretId = optional('DB_SECRET_ID');
  if (dbSecretId) config.dbSecretId = dbSecretId;
  const databaseUrl = optional('DATABASE_URL');
  if (databaseUrl) config.databaseUrl = databaseUrl;
  const statusColumn = optional('CLIENTE_STATUS_COLUMN');
  if (statusColumn) {
    config.clienteStatusColumn = identifier('CLIENTE_STATUS_COLUMN', statusColumn);
  }

  if (!config.jwtSecretId && !config.jwtSecret) {
    throw new Error('Defina JWT_SECRET_ID (Secrets Manager) ou JWT_SECRET (local).');
  }
  if (!config.dbSecretId && !config.databaseUrl) {
    throw new Error('Defina DB_SECRET_ID (Secrets Manager) ou DATABASE_URL (local).');
  }

  return config;
}
