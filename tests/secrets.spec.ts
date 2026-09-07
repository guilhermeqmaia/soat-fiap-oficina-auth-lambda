import { buildDatabaseUrl, extractSecretValue, SecretsManagerReader } from '../src/infra/secrets';

describe('extractSecretValue', () => {
  it('devolve o texto quando o secret nao e JSON', () => {
    expect(extractSecretValue('meu-segredo', 'JWT_SECRET')).toBe('meu-segredo');
  });

  it('extrai a chave quando o secret e JSON', () => {
    expect(extractSecretValue('{"JWT_SECRET":"abc"}', 'JWT_SECRET')).toBe('abc');
  });

  it('falha quando a chave nao existe no JSON', () => {
    expect(() => extractSecretValue('{"outra":"abc"}', 'JWT_SECRET')).toThrow(/chave/);
  });

  it('trata JSON malformado como texto puro', () => {
    expect(extractSecretValue('{nao-json', 'JWT_SECRET')).toBe('{nao-json');
  });
});

describe('buildDatabaseUrl', () => {
  it('aceita connection string em texto puro', () => {
    expect(buildDatabaseUrl('postgresql://u:p@h:5432/d')).toBe('postgresql://u:p@h:5432/d');
  });

  it('aceita JSON com DATABASE_URL', () => {
    expect(buildDatabaseUrl('{"DATABASE_URL":"postgresql://u:p@h:5432/d"}')).toBe(
      'postgresql://u:p@h:5432/d',
    );
  });

  it('monta a URL a partir do secret gerado pelo RDS', () => {
    const secret = JSON.stringify({
      username: 'oficina',
      password: 'p@ss word',
      host: 'db.rds.amazonaws.com',
      port: 5432,
      dbname: 'oficina_mecanica',
    });
    expect(buildDatabaseUrl(secret)).toBe(
      'postgresql://oficina:p%40ss%20word@db.rds.amazonaws.com:5432/oficina_mecanica?schema=public',
    );
  });

  it('falha quando o secret nao tem host/username', () => {
    expect(() => buildDatabaseUrl('{"password":"x"}')).toThrow(/host\/username/);
  });
});

describe('SecretsManagerReader', () => {
  it('cacheia o valor entre chamadas (uma unica ida ao Secrets Manager)', async () => {
    const send = jest.fn().mockResolvedValue({ SecretString: 'valor' });
    const reader = new SecretsManagerReader({ send } as never);

    await expect(reader.getSecretString('oficina/jwt')).resolves.toBe('valor');
    await expect(reader.getSecretString('oficina/jwt')).resolves.toBe('valor');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('aceita secret binario', async () => {
    const send = jest.fn().mockResolvedValue({ SecretBinary: Buffer.from('bin', 'utf8') });
    const reader = new SecretsManagerReader({ send } as never);
    await expect(reader.getSecretString('s')).resolves.toBe('bin');
  });

  it('falha quando o secret esta vazio', async () => {
    const send = jest.fn().mockResolvedValue({});
    const reader = new SecretsManagerReader({ send } as never);
    await expect(reader.getSecretString('s')).rejects.toThrow(/nao possui valor/);
  });
});
