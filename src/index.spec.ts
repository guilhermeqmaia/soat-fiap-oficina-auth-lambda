import jwt from 'jsonwebtoken';
import { handler } from './index';

jest.mock('./infrastructure/db', () => ({
  findClienteByCpf: jest.fn().mockResolvedValue({ id: 'cli-1', nome: 'Maria' }),
  findUsuarioByCpf: jest.fn(),
}));

describe('handler único — despacho por formato de evento', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste';
  });

  it('evento de authorizer (type REQUEST) vai para o fluxo de autorização', async () => {
    const token = jwt.sign({ cpf: '11144477735', role: 'CLIENTE' }, 'segredo-de-teste', {
      algorithm: 'HS256', subject: 'cli-1', issuer: 'oficina-auth-lambda', expiresIn: 60,
    });
    const result = (await handler({
      type: 'REQUEST',
      identitySource: [`Bearer ${token}`],
      routeArn: 'arn:aws:execute-api:us-east-1:123:api/$default/GET/clientes',
    } as never)) as { isAuthorized: boolean; context: Record<string, string> };

    expect(result.isAuthorized).toBe(true);
    expect(result.context.sub).toBe('cli-1');
  });

  it('authorizer nega token inválido sem lançar', async () => {
    const result = (await handler({
      type: 'REQUEST',
      identitySource: ['Bearer token-podre'],
    } as never)) as { isAuthorized: boolean };
    expect(result.isAuthorized).toBe(false);
  });

  it('evento HTTP vai para o fluxo de autenticação', async () => {
    const result = (await handler({
      version: '2.0',
      routeKey: 'POST /auth',
      body: JSON.stringify({ cpf: '11144477735' }),
      isBase64Encoded: false,
      requestContext: { requestId: 'req-1' },
    } as never)) as { statusCode: number };
    expect(result.statusCode).toBe(200);
  });
});
