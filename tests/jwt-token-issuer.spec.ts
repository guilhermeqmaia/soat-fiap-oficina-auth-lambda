import jwt from 'jsonwebtoken';
import { JwtTokenIssuer } from '../src/infra/jwt-token-issuer';
import { Cliente } from '../src/application/ports';
import { Config, loadConfig } from '../src/config/env';

const cliente: Cliente = {
  id: 'cliente-uuid',
  nome: 'Ana Souza',
  cpf: '52998224725',
  status: 'ATIVO',
  ativo: true,
};

function makeConfig(overrides: Partial<Config> = {}): Config {
  process.env['JWT_SECRET'] = 'segredo-de-teste';
  process.env['DATABASE_URL'] = 'postgresql://u:p@localhost:5432/db';
  const config = loadConfig();
  return { ...config, ...overrides };
}

describe('JwtTokenIssuer', () => {
  const secret = 'segredo-de-teste';

  it('emite token com as claims do contrato (sub, cpf, role, iss, exp)', async () => {
    const issuer = new JwtTokenIssuer(secret, makeConfig({ jwtIssuer: 'oficina-auth-lambda' }));

    const issued = await issuer.issue({ cliente, role: 'CLIENTE' });
    const decoded = jwt.verify(issued.token, secret) as Record<string, unknown>;

    expect(decoded['sub']).toBe('cliente-uuid');
    expect(decoded['cpf']).toBe('52998224725');
    expect(decoded['nome']).toBe('Ana Souza');
    expect(decoded['role']).toBe('CLIENTE');
    expect(decoded['iss']).toBe('oficina-auth-lambda');
    expect(typeof decoded['exp']).toBe('number');
    expect(issued.tokenType).toBe('Bearer');
    expect(new Date(issued.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('inclui audience quando configurada', async () => {
    const issuer = new JwtTokenIssuer(secret, makeConfig({ jwtAudience: 'oficina-api' }));
    const issued = await issuer.issue({ cliente, role: 'CLIENTE' });
    expect(issued.claims.aud).toBe('oficina-api');
    await expect(issuer.verify(issued.token)).resolves.toMatchObject({ aud: 'oficina-api' });
  });

  it('valida o proprio token e devolve as claims', async () => {
    const issuer = new JwtTokenIssuer(secret, makeConfig());
    const issued = await issuer.issue({ cliente, role: 'CLIENTE' });
    await expect(issuer.verify(issued.token)).resolves.toMatchObject({
      sub: 'cliente-uuid',
      role: 'CLIENTE',
    });
  });

  it('recusa token assinado com outro segredo', async () => {
    const config = makeConfig();
    const issued = await new JwtTokenIssuer('outro-segredo', config).issue({
      cliente,
      role: 'CLIENTE',
    });
    await expect(new JwtTokenIssuer(secret, config).verify(issued.token)).rejects.toThrow();
  });

  it('recusa token expirado', async () => {
    const config = makeConfig({ jwtExpiresIn: '-1s' });
    const issuer = new JwtTokenIssuer(secret, config);
    const issued = await issuer.issue({ cliente, role: 'CLIENTE' });
    await expect(issuer.verify(issued.token)).rejects.toThrow(/expired/i);
  });

  it('recusa token de outro emissor', async () => {
    const issued = await new JwtTokenIssuer(secret, makeConfig({ jwtIssuer: 'outro' })).issue({
      cliente,
      role: 'CLIENTE',
    });
    await expect(new JwtTokenIssuer(secret, makeConfig()).verify(issued.token)).rejects.toThrow();
  });

  it('recusa payload nao-JSON', async () => {
    const token = jwt.sign('texto-puro', secret, { algorithm: 'HS256' });
    await expect(new JwtTokenIssuer(secret, makeConfig()).verify(token)).rejects.toThrow();
  });
});
