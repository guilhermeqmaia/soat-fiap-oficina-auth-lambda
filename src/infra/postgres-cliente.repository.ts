import { Pool, PoolConfig } from 'pg';
import { Config } from '../config/env';
import { Cliente, ClienteRepository } from '../application/ports';

/**
 * Consulta o cliente no banco gerenciado (RDS PostgreSQL) pelo CPF.
 *
 * O pool vive no escopo do container da Lambda e e reaproveitado entre
 * invocacoes (`max: 1` — cada container atende uma requisicao por vez, e isso
 * evita estourar o limite de conexoes do RDS com muitos containers ativos).
 *
 * A comparacao ignora mascara: o CPF pode estar gravado com ou sem pontuacao.
 */
export class PostgresClienteRepository implements ClienteRepository {
  constructor(
    private readonly pool: Pool,
    private readonly config: Config,
  ) {}

  static createPool(databaseUrl: string, config: Config): Pool {
    const poolConfig: PoolConfig = {
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: config.dbConnectionTimeoutMs,
      query_timeout: config.dbQueryTimeoutMs,
      statement_timeout: config.dbQueryTimeoutMs,
      idleTimeoutMillis: 30_000,
      allowExitOnIdle: true,
    };
    if (config.dbSsl) {
      // RDS usa certificado de CA propria; a conexao continua cifrada.
      poolConfig.ssl = { rejectUnauthorized: false };
    }
    return new Pool(poolConfig);
  }

  async findByCpf(cpf: string): Promise<Cliente | null> {
    const { clienteTable, clienteIdColumn, clienteNomeColumn, clienteCpfColumn } = this.config;
    const statusColumn = this.config.clienteStatusColumn;
    const statusSelect = statusColumn ? `, "${statusColumn}"::text AS status` : '';

    const sql = `
      SELECT "${clienteIdColumn}"::text  AS id,
             "${clienteNomeColumn}"      AS nome,
             "${clienteCpfColumn}"       AS cpf${statusSelect}
        FROM "${clienteTable}"
       WHERE regexp_replace("${clienteCpfColumn}", '[^0-9]', '', 'g') = $1
       LIMIT 1
    `;

    const result = await this.pool.query<{
      id: string;
      nome: string;
      cpf: string;
      status?: string | null;
    }>(sql, [cpf]);

    const row = result.rows[0];
    if (!row) return null;

    const status = statusColumn ? (row.status ?? '') : 'ATIVO';
    return {
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      status,
      ativo: statusColumn
        ? this.config.clienteStatusAtivoValues.includes(status.trim().toLowerCase())
        : true,
    };
  }
}
