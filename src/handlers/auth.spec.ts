import jwt from 'jsonwebtoken';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { handleAuth } from './auth';

jest.mock('../infrastructure/db', () => ({
  findClienteByCpf: jest.fn(),
  findUsuarioByCpf: jest.fn(),
}));
import { findClienteByCpf } from '../infrastructure/db';

const CPF_VALIDO = '11144477735';

function makeEvent(body: string | undefined, isBase64 = false): APIGatewayProxyEventV2 {
  return {
    body,
    isBase64Encoded: isBase64,
    requestContext: { requestId: 'req-1' },
  } as unknown as APIGatewayProxyEventV2;
}

describe('handleAuth (evento HTTP do API Gateway)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'segredo-de-teste';
    jest.clearAllMocks();
  });

  it('200 com JWT verificável para cliente existente', async () => {
    (findClienteByCpf as jest.Mock).mockResolvedValue({ id: 'cli-1', nome: 'Maria' });
    const res = (await handleAuth(
      makeEvent(JSON.stringify({ cpf: CPF_VALIDO })),
    )) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(200);
    const { token } = JSON.parse(res.body!);
    const payload = jwt.verify(token, 'segredo-de-teste') as jwt.JwtPayload;
    expect(payload.sub).toBe('cli-1');
    expect(payload.role).toBe('CLIENTE');
  });

  it('aceita corpo em base64 (isBase64Encoded)', async () => {
    (findClienteByCpf as jest.Mock).mockResolvedValue({ id: 'cli-1', nome: 'Maria' });
    const b64 = Buffer.from(JSON.stringify({ cpf: CPF_VALIDO })).toString('base64');
    const res = (await handleAuth(makeEvent(b64, true))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(200);
  });

  it('400 para JSON malformado', async () => {
    const res = (await handleAuth(makeEvent('{cpf:'))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(400);
  });

  it('400 para corpo ausente (sem CPF)', async () => {
    const res = (await handleAuth(makeEvent(undefined))) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(400);
  });

  it('404 para cliente inexistente', async () => {
    (findClienteByCpf as jest.Mock).mockResolvedValue(null);
    const res = (await handleAuth(
      makeEvent(JSON.stringify({ cpf: CPF_VALIDO })),
    )) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(404);
  });

  it('500 sem vazar detalhes quando a infraestrutura falha', async () => {
    (findClienteByCpf as jest.Mock).mockRejectedValue(new Error('rds indisponível'));
    const res = (await handleAuth(
      makeEvent(JSON.stringify({ cpf: CPF_VALIDO })),
    )) as APIGatewayProxyStructuredResultV2;
    expect(res.statusCode).toBe(500);
    expect(res.body).toBe(JSON.stringify({ erro: 'Erro interno' }));
  });
});
