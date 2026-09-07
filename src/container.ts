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

export interface Container {
  config: Config;
  logger: Logger;
  autenticarCliente: AutenticarClienteUseCase;
  autenticarStaff: AutenticarStaffUseCase;
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

  // As duas buscas ao Secrets Manager sao independentes: em paralelo o cold
  // start paga apenas a mais lenta, nao a soma.
  const [jwtSecret, databaseUrl] = await Promise.all([
    config.jwtSecretId
      ? secrets
          .getSecretString(config.jwtSecretId)
          .then((value) => extractSecretValue(value, config.jwtSecretJsonKey))
      : Promise.resolve(config.jwtSecret as string),
    config.dbSecretId
      ? secrets.getSecretString(config.dbSecretId).then(buildDatabaseUrl)
      : Promise.resolve(config.databaseUrl as string),
  ]);

  pool ??= PostgresClienteRepository.createPool(databaseUrl, config);
  const clientes = new PostgresClienteRepository(pool, config);
  const usuarios = new PostgresUsuarioRepository(pool, config);
  const tokens = new JwtTokenIssuer(jwtSecret, config);

  return {
    config,
    logger,
    tokens,
    autenticarCliente: new AutenticarClienteUseCase(clientes, tokens, config.clienteRole),
    autenticarStaff: new AutenticarStaffUseCase(usuarios, new BcryptPasswordVerifier(), tokens),
  };
}
