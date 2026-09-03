import { Pool } from 'pg';
import { ClienteRecord, UsuarioRecord } from '../application/authenticate';
import { getDatabaseUrl } from './secrets';

/**
 * Acesso ao RDS PostgreSQL (repo soat-fiap-oficina-infra-db). Pool em escopo
 * de módulo: reaproveitado entre invocações do mesmo container (US-F3-01 —
 * "conexão ao RDS reaproveitada"). max=1 porque cada container Lambda
 * processa uma invocação por vez.
 */

let pool: Pool | undefined;

async function getPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({
      connectionString: await getDatabaseUrl(),
      max: 1,
      idleTimeoutMillis: 30_000,
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function findClienteByCpf(cpf: string): Promise<ClienteRecord | null> {
  const db = await getPool();
  const result = await db.query<ClienteRecord>(
    'SELECT id, nome FROM cliente WHERE cpf_cnpj = $1',
    [cpf],
  );
  return result.rows[0] ?? null;
}

/**
 * A coluna usuario.cpf nasce na migration da US-F3-03 (repo da aplicação,
 * dono do schema) — contrato: CPF único, associado ao usuário do staff.
 */
export async function findUsuarioByCpf(cpf: string): Promise<UsuarioRecord | null> {
  const db = await getPool();
  const result = await db.query<UsuarioRecord>(
    'SELECT id, nome, role, ativo, senha_hash AS "senhaHash" FROM usuario WHERE cpf = $1',
    [cpf],
  );
  return result.rows[0] ?? null;
}
