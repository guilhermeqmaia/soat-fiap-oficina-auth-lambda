import { Pool } from 'pg';
import { AutenticarClienteUseCase } from './application/autenticar-cliente.use-case';
import { TokenIssuer } from './application/ports';
import { Config, loadConfig } from './config/env';
import { JwtTokenIssuer } from './infra/jwt-token-issuer';
import { PostgresClienteRepository } from './infra/postgres-cliente.repository';
import {
  buildDatabaseUrl,
  extractSecretValue,
  SecretsManagerReader,
  SecretsReader,
} from './infra/secrets';
import { Logger } from './shared/logger';

export interface Container {
  config: Config;
  logger: Logger;
  autenticarCliente: AutenticarClienteUseCase;
  tokens: TokenIssuer;
}

/**
 * Composicao das dependencias, resolvida uma vez por container da Lambda
 * (cold start) e reaproveitada nas invocacoes seguintes: segredos ja lidos do
 * Secrets Manager e pool de conexoes do Postgres ficam em memoria.
 */
let cached: Promise<Container> | undefined;
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

/** Usado nos testes para descartar o estado de cold start entre casos. */
export function resetContainer(): void {
  cached = undefined;
  pool = undefined;
}

async function build(secrets: SecretsReader): Promise<Container> {
  const config = loadConfig();
  const logger = new Logger(config.logLevel);

  const jwtSecret = config.jwtSecretId
    ? extractSecretValue(await secrets.getSecretString(config.jwtSecretId), config.jwtSecretJsonKey)
    : (config.jwtSecret as string);

  const databaseUrl = config.dbSecretId
    ? buildDatabaseUrl(await secrets.getSecretString(config.dbSecretId))
    : (config.databaseUrl as string);

  pool ??= PostgresClienteRepository.createPool(databaseUrl, config);
  const clientes = new PostgresClienteRepository(pool, config);
  const tokens = new JwtTokenIssuer(jwtSecret, config);

  return {
    config,
    logger,
    tokens,
    autenticarCliente: new AutenticarClienteUseCase(clientes, tokens, config.clienteRole),
  };
}
