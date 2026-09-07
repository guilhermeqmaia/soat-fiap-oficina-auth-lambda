import type { Pool } from 'pg';
import { PostgresUsuarioRepository } from '../src/infra/postgres-usuario.repository';
import { Config, loadConfig } from '../src/config/env';

function makeConfig(overrides: Partial<Config> = {}): Config {
  process.env['JWT_SECRET'] = 's';
  process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';
  return { ...loadConfig(), ...overrides };
}

function makePool(rows: Record<string, unknown>[]) {
  const query = jest.fn().mockResolvedValue({ rows });
  return { pool: { query } as unknown as Pool, query };
}

describe('PostgresUsuarioRepository', () => {
  it('consulta o usuario por igualdade direta no CPF normalizado (indice da US-F3-03)', async () => {
    const { pool, query } = makePool([
      { id: 'u1', nome: 'Joao', role: 'MECANICO', ativo: true, senhaHash: '$2b$10$h' },
    ]);
    const repo = new PostgresUsuarioRepository(pool, makeConfig());

    const usuario = await repo.findByCpf('52998224725');

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM "usuario"');
    expect(sql).toContain('"cpf" = $1');
    expect(sql).not.toContain('regexp_replace');
    expect(params).toEqual(['52998224725']);
    expect(usuario).toEqual({
      id: 'u1',
      nome: 'Joao',
      cpf: '52998224725',
      role: 'MECANICO',
      ativo: true,
      senhaHash: '$2b$10$h',
    });
  });

  it('devolve null quando nao ha usuario para o CPF', async () => {
    const { pool } = makePool([]);
    const repo = new PostgresUsuarioRepository(pool, makeConfig());
    await expect(repo.findByCpf('52998224725')).resolves.toBeNull();
  });

  it('respeita tabela/coluna configuraveis', async () => {
    const { pool, query } = makePool([]);
    const repo = new PostgresUsuarioRepository(
      pool,
      makeConfig({ usuarioTable: 'funcionarios', usuarioCpfColumn: 'documento' }),
    );
    await repo.findByCpf('52998224725');
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('FROM "funcionarios"');
    expect(sql).toContain('"documento" = $1');
  });
});
