import { Pool } from 'pg';
import { Config } from '../config/env';
import { Usuario, UsuarioRepository } from '../application/ports';

/**
 * Consulta o usuario do staff pelo CPF. Compartilha o pool do container com o
 * repositorio de clientes (mesmo banco, `max: 1`).
 *
 * A coluna de CPF (`usuario.cpf`) e criada pela migration da US-F3-03 no repo
 * da aplicacao, com o valor gravado **normalizado** (so digitos) — por isso a
 * comparacao aqui e igualdade direta, aproveitando o indice unico da coluna.
 */
export class PostgresUsuarioRepository implements UsuarioRepository {
  constructor(
    private readonly pool: Pool,
    private readonly config: Config,
  ) {}

  async findByCpf(cpf: string): Promise<Usuario | null> {
    const { usuarioTable, usuarioCpfColumn } = this.config;

    const sql = `
      SELECT id::text        AS id,
             nome            AS nome,
             role::text      AS role,
             ativo           AS ativo,
             senha_hash      AS "senhaHash"
        FROM "${usuarioTable}"
       WHERE "${usuarioCpfColumn}" = $1
       LIMIT 1
    `;

    const result = await this.pool.query<{
      id: string;
      nome: string;
      role: string;
      ativo: boolean;
      senhaHash: string;
    }>(sql, [cpf]);

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      nome: row.nome,
      cpf,
      role: row.role,
      ativo: row.ativo,
      senhaHash: row.senhaHash,
    };
  }
}
