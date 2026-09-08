import { Pool } from 'pg';
import { AutenticarClienteUseCase } from './application/autenticar-cliente.use-case';
import { AutenticarStaffUseCase } from './application/autenticar-staff.use-case';
import { TokenIssuer } from './application/ports';
import { Config, loadConfig } from './config/env';
import { BcryptPasswordVerifier } from './infra/bcrypt-password-verifier';
import { JwtTokenIssuer } from './infra/jwt-token-issuer';
import { PostgresClienteRepository } from './infra/postgres-cliente.repository';
import { PostgresUsuarioRepository } from './infra/postgres-usuario.repository';
import {
  buildDatabaseUrl,
  extractSecretValue,
  SecretsManagerReader,
  SecretsReader,
} from './infra/secrets';
import { Logger } from './shared/logger';

/**
 * Dependencias que NAO tocam o banco — bastam para o Lambda Authorizer, que
 * so verifica assinatura de token. Mante-las separadas evita que o caminho
 * mais quente do sistema pague, no cold start, um GetSecretValue do banco que
 * nunca usaria.
 */
export interface Container {
  config: Config;
  logger: Logger;
  tokens: TokenIssuer;
}

/** Container do fluxo de autenticacao: acrescenta os casos de uso com banco. */
export interface AuthContainer extends Container {
  autenticarCliente: AutenticarClienteUseCase;
  autenticarStaff: AutenticarStaffUseCase;
}

/**
 * Composicao das dependencias, resolvida uma vez por container da Lambda
 * (cold start) e reaproveitada nas invocacoes seguintes: segredos ja lidos do
 * Secrets Manager e pool de conexoes do Postgres ficam em memoria.
 */
let cached: Promise<Container> | undefined;
let cachedAuth: Promise<AuthContainer> | undefined;
let pool: Pool | undefined;

export function getContainer(
  secrets: SecretsReader = new SecretsManagerReader(),
): Promise<Container> {
  if (!cached) {
    cached = build(secrets).catch((error: unknown) => {
      cached = undefined; // erro de bootstrap nao deve ficar cacheado
      throw error;
    });
  }
  return cached;
}

/** Container do fluxo `POST /auth` (resolve o banco na primeira invocacao). */
export function getAuthContainer(
  secrets: SecretsReader = new SecretsManagerReader(),
): Promise<AuthContainer> {
  if (!cachedAuth) {
    cachedAuth = buildAuth(secrets).catch((error: unknown) => {
      cachedAuth = undefined; // erro de bootstrap nao deve ficar cacheado
      throw error;
    });
  }
  return cachedAuth;
}

/** Usado nos testes para descartar o estado de cold start entre casos. */
export function resetContainer(): void {
  cached = undefined;
  cachedAuth = undefined;
  pool = undefined;
}

async function build(secrets: SecretsReader): Promise<Container> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);

  const jwtSecret = config.jwtSecretId
    ? extractSecretValue(await secrets.getSecretString(config.jwtSecretId), config.jwtSecretJsonKey)
    : (config.jwtSecret as string);

  return { config, logger, tokens: new JwtTokenIssuer(jwtSecret, config) };
}

async function buildAuth(secrets: SecretsReader): Promise<AuthContainer> {
  // O segredo do JWT e a connection string sao independentes: em paralelo o
  // cold start do /auth paga apenas a mais lenta, nao a soma.
  const [base, databaseUrl] = await Promise.all([
    getContainer(secrets),
    (async () => {
      const config = loadConfig();
      return config.dbSecretId
        ? buildDatabaseUrl(await secrets.getSecretString(config.dbSecretId))
        : (config.databaseUrl as string);
    })(),
  ]);

  const { config, tokens } = base;
  pool ??= PostgresClienteRepository.createPool(databaseUrl, config);
  const clientes = new PostgresClienteRepository(pool, config);
  const usuarios = new PostgresUsuarioRepository(pool, config);

  return {
    ...base,
    autenticarCliente: new AutenticarClienteUseCase(clientes, tokens, config.clienteRole),
    autenticarStaff: new AutenticarStaffUseCase(usuarios, new BcryptPasswordVerifier(), tokens),
  };
}
