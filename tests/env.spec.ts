import { loadConfig } from '../src/config/env';

const ORIGINAL_ENV = { ...process.env };

describe('loadConfig', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env['JWT_SECRET'];
    delete process.env['JWT_SECRET_ID'];
    delete process.env['DATABASE_URL'];
    delete process.env['DB_SECRET_ID'];
    delete process.env['CLIENTE_STATUS_COLUMN'];
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('usa os defaults do schema da Fase 2', () => {
    process.env['JWT_SECRET'] = 's';
    process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';

    const config = loadConfig();

    expect(config.clienteTable).toBe('cliente');
    expect(config.clienteCpfColumn).toBe('cpf_cnpj');
    expect(config.clienteStatusColumn).toBeUndefined();
    expect(config.jwtIssuer).toBe('oficina-auth-lambda');
    expect(config.jwtExpiresIn).toBe('1h');
    expect(config.clienteRole).toBe('CLIENTE');
    expect(config.usuarioTable).toBe('usuario');
    expect(config.usuarioCpfColumn).toBe('cpf');
    expect(config.dbSsl).toBe(true);
  });

  it('converte JWT_EXPIRES_IN numerico para number (segundos, nao ms)', () => {
    process.env['JWT_SECRET'] = 's';
    process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';
    process.env['JWT_EXPIRES_IN'] = '3600';

    expect(loadConfig().jwtExpiresIn).toBe(3600);
  });

  it('rejeita JWT_EXPIRES_IN numerico nao-positivo', () => {
    process.env['JWT_SECRET'] = 's';
    process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';
    process.env['JWT_EXPIRES_IN'] = '0';

    expect(() => loadConfig()).toThrow(/JWT_EXPIRES_IN/);
  });

  it('exige segredo de JWT (env ou Secrets Manager)', () => {
    process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';
    expect(() => loadConfig()).toThrow(/JWT_SECRET_ID/);
  });

  it('exige origem do banco (env ou Secrets Manager)', () => {
    process.env['JWT_SECRET'] = 's';
    expect(() => loadConfig()).toThrow(/DB_SECRET_ID/);
  });

  it('rejeita nome de tabela/coluna que nao seja identificador SQL', () => {
    process.env['JWT_SECRET'] = 's';
    process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';
    process.env['CLIENTE_TABLE'] = 'cliente; DROP TABLE cliente';
    expect(() => loadConfig()).toThrow(/identificador SQL/);
    delete process.env['CLIENTE_TABLE'];
  });

  it('rejeita timeout nao numerico', () => {
    process.env['JWT_SECRET'] = 's';
    process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';
    process.env['DB_QUERY_TIMEOUT_MS'] = 'abc';
    expect(() => loadConfig()).toThrow(/numero positivo/);
    delete process.env['DB_QUERY_TIMEOUT_MS'];
  });

  it('le coluna de status, valores de ativo e flags booleanas', () => {
    process.env['JWT_SECRET_ID'] = 'oficina/jwt';
    process.env['DB_SECRET_ID'] = 'oficina/db';
    process.env['CLIENTE_STATUS_COLUMN'] = 'ativo';
    process.env['CLIENTE_STATUS_ATIVO_VALUES'] = 'true, ATIVO';
    process.env['DB_SSL'] = 'false';
    process.env['LOG_LEVEL'] = 'debug';

    const config = loadConfig();

    expect(config.clienteStatusColumn).toBe('ativo');
    expect(config.clienteStatusAtivoValues).toEqual(['true', 'ativo']);
    expect(config.dbSsl).toBe(false);
    expect(config.logLevel).toBe('debug');
    expect(config.jwtSecretId).toBe('oficina/jwt');
    expect(config.dbSecretId).toBe('oficina/db');
  });

  it('cai para info em LOG_LEVEL desconhecido', () => {
    process.env['JWT_SECRET'] = 's';
    process.env['DATABASE_URL'] = 'postgresql://u:p@h:5432/d';
    process.env['LOG_LEVEL'] = 'trace';
    expect(loadConfig().logLevel).toBe('info');
  });
});
