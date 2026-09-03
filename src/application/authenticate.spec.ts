import { authenticate, AuthenticateDeps } from './authenticate';

const CPF_VALIDO = '11144477735';

function makeDeps(overrides: Partial<AuthenticateDeps> = {}): AuthenticateDeps {
  return {
    findClienteByCpf: jest.fn().mockResolvedValue({ id: 'cli-1', nome: 'Maria' }),
    findUsuarioByCpf: jest.fn().mockResolvedValue({
      id: 'usr-1',
      nome: 'João',
      role: 'ATENDENTE',
      ativo: true,
      senhaHash: '$2b$10$hash',
    }),
    verifyPassword: jest.fn().mockResolvedValue(true),
    signToken: jest.fn().mockResolvedValue('jwt-assinado'),
    log: jest.fn(),
    ...overrides,
  };
}

describe('authenticate — validação de entrada', () => {
  it('400 sem CPF no corpo', async () => {
    const result = await authenticate({}, makeDeps());
    expect(result.statusCode).toBe(400);
  });

  it('422 para CPF com dígitos verificadores inválidos', async () => {
    const result = await authenticate({ cpf: '11144477734' }, makeDeps());
    expect(result.statusCode).toBe(422);
  });

  it('não consulta a base quando o CPF é inválido', async () => {
    const deps = makeDeps();
    await authenticate({ cpf: '11111111111' }, deps);
    expect(deps.findClienteByCpf).not.toHaveBeenCalled();
    expect(deps.findUsuarioByCpf).not.toHaveBeenCalled();
  });
});

describe('authenticate — fluxo CLIENTE (só CPF)', () => {
  it('200 com token para cliente existente', async () => {
    const deps = makeDeps();
    const result = await authenticate({ cpf: '111.444.777-35' }, deps);
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ token: 'jwt-assinado' });
    expect(deps.signToken).toHaveBeenCalledWith({
      sub: 'cli-1',
      cpf: CPF_VALIDO,
      role: 'CLIENTE',
    });
  });

  it('404 para cliente inexistente', async () => {
    const deps = makeDeps({ findClienteByCpf: jest.fn().mockResolvedValue(null) });
    const result = await authenticate({ cpf: CPF_VALIDO }, deps);
    expect(result.statusCode).toBe(404);
  });

  it('nunca loga o CPF completo', async () => {
    const deps = makeDeps({ findClienteByCpf: jest.fn().mockResolvedValue(null) });
    await authenticate({ cpf: CPF_VALIDO }, deps);
    const logged = JSON.stringify((deps.log as jest.Mock).mock.calls);
    expect(logged).not.toContain(CPF_VALIDO);
    expect(logged).toContain('***.***.***-35');
  });
});

describe('authenticate — fluxo STAFF (CPF + senha)', () => {
  it('200 com token carregando a role do usuário', async () => {
    const deps = makeDeps();
    const result = await authenticate({ cpf: CPF_VALIDO, senha: 's3nh4' }, deps);
    expect(result.statusCode).toBe(200);
    expect(deps.signToken).toHaveBeenCalledWith({
      sub: 'usr-1',
      cpf: CPF_VALIDO,
      role: 'ATENDENTE',
    });
    expect(deps.findClienteByCpf).not.toHaveBeenCalled();
  });

  it('404 para usuário inexistente', async () => {
    const deps = makeDeps({ findUsuarioByCpf: jest.fn().mockResolvedValue(null) });
    const result = await authenticate({ cpf: CPF_VALIDO, senha: 's3nh4' }, deps);
    expect(result.statusCode).toBe(404);
  });

  it('403 para usuário inativo', async () => {
    const deps = makeDeps({
      findUsuarioByCpf: jest.fn().mockResolvedValue({
        id: 'usr-1', nome: 'João', role: 'ATENDENTE', ativo: false, senhaHash: 'h',
      }),
    });
    const result = await authenticate({ cpf: CPF_VALIDO, senha: 's3nh4' }, deps);
    expect(result.statusCode).toBe(403);
  });

  it('403 para senha incorreta (sem revelar qual credencial falhou)', async () => {
    const deps = makeDeps({ verifyPassword: jest.fn().mockResolvedValue(false) });
    const result = await authenticate({ cpf: CPF_VALIDO, senha: 'errada' }, deps);
    expect(result.statusCode).toBe(403);
    expect(result.body).toEqual({ erro: 'Credenciais inválidas' });
  });

  it('400 para senha vazia', async () => {
    const result = await authenticate({ cpf: CPF_VALIDO, senha: '' }, makeDeps());
    expect(result.statusCode).toBe(400);
  });
});
