import { getAuthContainer, getContainer, resetContainer } from '../src/container';
import { SecretsReader } from '../src/infra/secrets';

const ORIGINAL_ENV = { ...process.env };

/** Reader que registra QUAIS segredos foram buscados. */
function spyReader(): SecretsReader & { ids: string[] } {
  const ids: string[] = [];
  return {
    ids,
    getSecretString: jest.fn(async (id: string) => {
      ids.push(id);
      return id === 'db-secret'
        ? JSON.stringify({ DATABASE_URL: 'postgresql://u:p@h:5432/d' })
        : 'segredo-jwt';
    }),
  };
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env['JWT_SECRET_ID'] = 'jwt-secret';
  process.env['DB_SECRET_ID'] = 'db-secret';
  delete process.env['JWT_SECRET'];
  delete process.env['DATABASE_URL'];
  resetContainer();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('container — custo de cold start por caminho', () => {
  it('o caminho do AUTHORIZER nao busca o segredo do banco', async () => {
    const secrets = spyReader();

    const container = await getContainer(secrets);

    expect(container.tokens).toBeDefined();
    expect(secrets.ids).toEqual(['jwt-secret']); // sem GetSecretValue do banco
  });

  it('o caminho do POST /auth busca os dois segredos e monta os casos de uso', async () => {
    const secrets = spyReader();

    const container = await getAuthContainer(secrets);

    expect(secrets.ids.sort()).toEqual(['db-secret', 'jwt-secret']);
    expect(container.autenticarCliente).toBeDefined();
    expect(container.autenticarStaff).toBeDefined();
  });

  it('reaproveita o container entre invocacoes (warm start)', async () => {
    const secrets = spyReader();

    await getContainer(secrets);
    await getContainer(secrets);

    expect(secrets.ids).toHaveLength(1);
  });

  it('nao cacheia erro de bootstrap', async () => {
    const falha: SecretsReader = {
      getSecretString: jest.fn().mockRejectedValueOnce(new Error('throttled')),
    };
    await expect(getContainer(falha)).rejects.toThrow('throttled');

    const ok = spyReader();
    await expect(getContainer(ok)).resolves.toBeDefined();
  });
});
