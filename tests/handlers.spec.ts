import jwt from 'jsonwebtoken';

const mockState: { rows: Record<string, unknown>[]; error?: Error } = { rows: [] };

jest.mock('pg', () => ({
  Pool: class {
    query(): Promise<{ rows: Record<string, unknown>[] }> {
      if (mockState.error) return Promise.reject(mockState.error);
      return Promise.resolve({ rows: mockState.rows });
    }
    end(): Promise<void> {
      return Promise.resolve();
    }
  },
}));

import { handler } from '../src/index';
import { authHandler, parseBody } from '../src/handlers/auth.handler';
import { authorizerHandler, extractBearerToken } from '../src/handlers/authorizer.handler';
import { resetContainer } from '../src/container';

const CPF = '52998224725';
const SECRET = 'segredo-de-teste';
const ORIGINAL_ENV = { ...process.env };

interface HttpLike {
  statusCode: number;
  body: string;
}

function body<T>(response: unknown): T {
  return JSON.parse((response as HttpLike).body) as T;
}

function authEvent(payload: unknown, isBase64Encoded = false): Record<string, unknown> {
  const raw = JSON.stringify(payload);
  return {
    requestContext: { requestId: 'req-1', http: { method: 'POST', path: '/auth' } },
    body: isBase64Encoded ? Buffer.from(raw, 'utf8').toString('base64') : raw,
    isBase64Encoded,
  };
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env['JWT_SECRET'] = SECRET;
  process.env['DATABASE_URL'] = 'postgresql://u:p@localhost:5432/oficina';
  process.env['DB_SSL'] = 'false';
  process.env['LOG_LEVEL'] = 'error';
  delete process.env['CLIENTE_STATUS_COLUMN'];
  mockState.rows = [];
  delete mockState.error;
  resetContainer();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('parseBody', () => {
  it('le body JSON, body base64 e invocacao direta', () => {
    expect(parseBody({ body: '{"cpf":"1"}' })).toEqual({ cpf: '1' });
    expect(
      parseBody({ body: Buffer.from('{"cpf":"1"}').toString('base64'), isBase64Encoded: true }),
    ).toEqual({ cpf: '1' });
    expect(parseBody({ cpf: '1' })).toEqual({ cpf: '1' });
  });

  it('devolve vazio para body ausente, vazio ou invalido', () => {
    expect(parseBody({})).toEqual({});
    expect(parseBody({ body: '   ' })).toEqual({});
    expect(parseBody({ body: 'nao-json' })).toEqual({});
    expect(parseBody({ body: '"texto"' })).toEqual({});
  });
});

describe('POST /auth', () => {
  it('200 com token para cliente existente', async () => {
    mockState.rows = [{ id: 'c1', nome: 'Ana Souza', cpf: '529.982.247-25' }];

    const response = (await authHandler(authEvent({ cpf: '529.982.247-25' }))) as HttpLike;
    const payload = body<{ accessToken: string; cliente: { cpf: string; role: string } }>(response);

    expect(response.statusCode).toBe(200);
    expect(payload.cliente.role).toBe('CLIENTE');
    expect(payload.cliente.cpf).toBe('529.***.**7-25'); // resposta nao devolve CPF completo
    const claims = jwt.verify(payload.accessToken, SECRET) as Record<string, unknown>;
    expect(claims).toMatchObject({
      sub: 'c1',
      cpf: CPF,
      role: 'CLIENTE',
      iss: 'oficina-auth-lambda',
    });
  });

  it('aceita body em base64 (API Gateway)', async () => {
    mockState.rows = [{ id: 'c1', nome: 'Ana', cpf: CPF }];
    const response = (await authHandler(authEvent({ cpf: CPF }, true))) as HttpLike;
    expect(response.statusCode).toBe(200);
  });

  it('400 sem CPF no body', async () => {
    const response = (await authHandler(authEvent({}))) as HttpLike;
    expect(response.statusCode).toBe(400);
    expect(body<{ error: string }>(response).error).toBe('CPF_AUSENTE');
  });

  it('422 para CPF invalido', async () => {
    const response = (await authHandler(authEvent({ cpf: '11111111111' }))) as HttpLike;
    expect(response.statusCode).toBe(422);
    expect(body<{ error: string }>(response).error).toBe('CPF_INVALIDO');
  });

  it('404 quando o cliente nao existe', async () => {
    const response = (await authHandler(authEvent({ cpf: CPF }))) as HttpLike;
    expect(response.statusCode).toBe(404);
    expect(body<{ error: string }>(response).error).toBe('CLIENTE_NAO_ENCONTRADO');
  });

  it('403 quando o cliente esta inativo', async () => {
    process.env['CLIENTE_STATUS_COLUMN'] = 'ativo';
    resetContainer();
    mockState.rows = [{ id: 'c1', nome: 'Ana', cpf: CPF, status: 'false' }];

    const response = (await authHandler(authEvent({ cpf: CPF }))) as HttpLike;

    expect(response.statusCode).toBe(403);
    expect(body<{ error: string }>(response).error).toBe('CLIENTE_INATIVO');
  });

  it('500 quando o banco falha', async () => {
    mockState.error = new Error('connection refused');
    const response = (await authHandler(authEvent({ cpf: CPF }))) as HttpLike;
    expect(response.statusCode).toBe(500);
    expect(body<{ error: string }>(response).error).toBe('ERRO_INTERNO');
  });

  it('500 quando a configuracao esta incompleta (sem cachear o erro de bootstrap)', async () => {
    delete process.env['JWT_SECRET'];
    resetContainer();

    const primeira = (await authHandler(authEvent({ cpf: CPF }))) as HttpLike;
    expect(primeira.statusCode).toBe(500);

    process.env['JWT_SECRET'] = SECRET;
    mockState.rows = [{ id: 'c1', nome: 'Ana', cpf: CPF }];
    const segunda = (await authHandler(authEvent({ cpf: CPF }))) as HttpLike;
    expect(segunda.statusCode).toBe(200);
  });
});

describe('extractBearerToken', () => {
  it('extrai do header Authorization em qualquer capitalizacao', () => {
    expect(extractBearerToken({ headers: { Authorization: 'Bearer abc' } })).toBe('abc');
    expect(extractBearerToken({ headers: { authorization: 'bearer abc' } })).toBe('abc');
  });

  it('aceita identitySource e token sem prefixo Bearer', () => {
    expect(extractBearerToken({ identitySource: ['Bearer abc'] })).toBe('abc');
    expect(extractBearerToken({ headers: { authorization: 'abc' } })).toBe('abc');
  });

  it('devolve undefined sem header', () => {
    expect(extractBearerToken({ headers: {} })).toBeUndefined();
  });
});

describe('Lambda Authorizer', () => {
  async function tokenValido(): Promise<string> {
    mockState.rows = [{ id: 'c1', nome: 'Ana', cpf: CPF }];
    const response = (await authHandler(authEvent({ cpf: CPF }))) as HttpLike;
    return body<{ accessToken: string }>(response).accessToken;
  }

  it('autoriza token valido e expoe as claims no contexto', async () => {
    const token = await tokenValido();

    const result = await authorizerHandler({
      type: 'REQUEST',
      routeArn: 'arn:aws:execute-api:us-east-1:1:api/$default/GET/clientes',
      headers: { authorization: `Bearer ${token}` },
    } as never);

    expect(result).toEqual({
      isAuthorized: true,
      context: { clienteId: 'c1', role: 'CLIENTE', cpf: CPF, nome: 'Ana' },
    });
  });

  it('nega sem token', async () => {
    await expect(authorizerHandler({ headers: {} })).resolves.toEqual({ isAuthorized: false });
  });

  it('nega token assinado com outro segredo', async () => {
    const token = jwt.sign({ cpf: CPF, role: 'CLIENTE' }, 'outro-segredo', {
      subject: 'c1',
      issuer: 'oficina-auth-lambda',
      expiresIn: '1h',
    });
    await expect(
      authorizerHandler({ headers: { authorization: `Bearer ${token}` } }),
    ).resolves.toEqual({ isAuthorized: false });
  });

  it('nega token expirado', async () => {
    const token = jwt.sign({ cpf: CPF, role: 'CLIENTE' }, SECRET, {
      subject: 'c1',
      issuer: 'oficina-auth-lambda',
      expiresIn: '-10s',
    });
    await expect(
      authorizerHandler({ headers: { authorization: `Bearer ${token}` } }),
    ).resolves.toEqual({ isAuthorized: false });
  });
});

describe('handler (entrada unica)', () => {
  it('roteia evento de authorizer para o authorizer', async () => {
    mockState.rows = [{ id: 'c1', nome: 'Ana', cpf: CPF }];
    const token = body<{ accessToken: string }>(
      await authHandler(authEvent({ cpf: CPF })),
    ).accessToken;

    const result = await handler({
      type: 'REQUEST',
      routeArn: 'arn:aws:execute-api:us-east-1:1:api/$default/GET/clientes',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(result).toMatchObject({ isAuthorized: true });
  });

  it('roteia evento HTTP para o POST /auth', async () => {
    mockState.rows = [{ id: 'c1', nome: 'Ana', cpf: CPF }];
    const result = (await handler(authEvent({ cpf: CPF }))) as HttpLike;
    expect(result.statusCode).toBe(200);
  });
});
