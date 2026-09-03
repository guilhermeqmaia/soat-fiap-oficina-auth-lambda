import { authorize, AuthorizeDeps } from './authorize';

function makeDeps(overrides: Partial<AuthorizeDeps> = {}): AuthorizeDeps {
  return {
    verifyToken: jest.fn().mockResolvedValue({ sub: 'cli-1', cpf: '11144477735', role: 'CLIENTE' }),
    log: jest.fn(),
    ...overrides,
  };
}

describe('authorize (Lambda Authorizer)', () => {
  it('autoriza Bearer token válido e propaga contexto ao backend', async () => {
    const result = await authorize('Bearer token-valido', makeDeps());
    expect(result).toEqual({
      isAuthorized: true,
      context: { sub: 'cli-1', role: 'CLIENTE', cpf: '11144477735' },
    });
  });

  it('aceita "bearer" minúsculo', async () => {
    const result = await authorize('bearer token-valido', makeDeps());
    expect(result.isAuthorized).toBe(true);
  });

  it('nega sem header', async () => {
    const deps = makeDeps();
    const result = await authorize(undefined, deps);
    expect(result.isAuthorized).toBe(false);
    expect(deps.verifyToken).not.toHaveBeenCalled();
  });

  it('nega header sem esquema Bearer', async () => {
    const result = await authorize('Basic dXNlcjpwYXNz', makeDeps());
    expect(result.isAuthorized).toBe(false);
  });

  it('nega token rejeitado pela verificação — sem lançar', async () => {
    const deps = makeDeps({ verifyToken: jest.fn().mockRejectedValue(new Error('expirado')) });
    const result = await authorize('Bearer token-podre', deps);
    expect(result.isAuthorized).toBe(false);
    expect(deps.log).toHaveBeenCalledWith('token_rejeitado', { motivo: 'expirado' });
  });
});
