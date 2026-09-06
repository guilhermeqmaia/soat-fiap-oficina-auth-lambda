import type { Pool } from 'pg';
import { PostgresClienteRepository } from '../src/infra/postgres-cliente.repository';
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

describe('PostgresClienteRepository', () => {
  it('consulta cliente por CPF ignorando mascara gravada no banco', async () => {
    const { pool, query } = makePool([{ id: 'c1', nome: 'Ana', cpf: '529.982.247-25' }]);
    const repo = new PostgresClienteRepository(pool, makeConfig());

    const cliente = await repo.findByCpf('52998224725');

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('FROM "cliente"');
    expect(sql).toContain('regexp_replace("cpf_cnpj"');
    expect(params).toEqual(['52998224725']);
    expect(cliente).toEqual({
      id: 'c1',
      nome: 'Ana',
      cpf: '529.982.247-25',
      status: 'ATIVO',
      ativo: true,
    });
  });

  it('devolve null quando o cliente nao existe', async () => {
    const { pool } = makePool([]);
    const repo = new PostgresClienteRepository(pool, makeConfig());
    await expect(repo.findByCpf('52998224725')).resolves.toBeNull();
  });

  it('sem coluna de status configurada, nao seleciona status e considera ativo', async () => {
    const { pool, query } = makePool([{ id: 'c1', nome: 'Ana', cpf: '52998224725' }]);
    const repo = new PostgresClienteRepository(pool, makeConfig());

    const cliente = await repo.findByCpf('52998224725');

    expect((query.mock.calls[0] as [string])[0]).not.toContain('AS status');
    expect(cliente?.ativo).toBe(true);
  });

  it('com coluna de status, marca inativo quando o valor nao esta na lista de ativos', async () => {
    const { pool, query } = makePool([
      { id: 'c1', nome: 'Ana', cpf: '52998224725', status: 'false' },
    ]);
    const repo = new PostgresClienteRepository(
      pool,
      makeConfig({ clienteStatusColumn: 'ativo', clienteStatusAtivoValues: ['true', 'ativo'] }),
    );

    const cliente = await repo.findByCpf('52998224725');

    expect((query.mock.calls[0] as [string])[0]).toContain('"ativo"::text AS status');
    expect(cliente).toMatchObject({ status: 'false', ativo: false });
  });

  it('com coluna de status, aceita valor de ativo em maiusculas', async () => {
    const { pool } = makePool([{ id: 'c1', nome: 'Ana', cpf: '52998224725', status: 'ATIVO' }]);
    const repo = new PostgresClienteRepository(
      pool,
      makeConfig({ clienteStatusColumn: 'status', clienteStatusAtivoValues: ['ativo'] }),
    );
    await expect(repo.findByCpf('52998224725')).resolves.toMatchObject({ ativo: true });
  });

  it('trata status nulo como inativo', async () => {
    const { pool } = makePool([{ id: 'c1', nome: 'Ana', cpf: '52998224725', status: null }]);
    const repo = new PostgresClienteRepository(
      pool,
      makeConfig({ clienteStatusColumn: 'status', clienteStatusAtivoValues: ['ativo'] }),
    );
    await expect(repo.findByCpf('52998224725')).resolves.toMatchObject({ ativo: false });
  });

  it('createPool habilita SSL conforme configuracao', () => {
    const comSsl = PostgresClienteRepository.createPool(
      'postgresql://u:p@h:5432/d',
      makeConfig({ dbSsl: true }),
    );
    const semSsl = PostgresClienteRepository.createPool(
      'postgresql://u:p@h:5432/d',
      makeConfig({ dbSsl: false }),
    );

    expect(comSsl.options.ssl).toEqual({ rejectUnauthorized: false });
    expect(semSsl.options.ssl).toBeUndefined();

    void comSsl.end();
    void semSsl.end();
  });
});
