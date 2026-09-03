import jwt from 'jsonwebtoken';
import { DEFAULT_ISSUER, DEFAULT_TTL_SECONDS, signToken, verifyToken } from './jwt';

const SECRET = 'segredo-de-teste';
const CLAIMS = { sub: 'cli-1', cpf: '11144477735', role: 'CLIENTE' };

describe('contrato do token (US-F3-01)', () => {
  afterEach(() => {
    delete process.env.JWT_ISSUER;
    delete process.env.JWT_TTL_SECONDS;
  });

  it('carrega as claims sub, cpf, role, iss e exp', () => {
    const token = signToken(CLAIMS, SECRET);
    const payload = jwt.decode(token) as jwt.JwtPayload;
    expect(payload.sub).toBe('cli-1');
    expect(payload.cpf).toBe('11144477735');
    expect(payload.role).toBe('CLIENTE');
    expect(payload.iss).toBe(DEFAULT_ISSUER);
    expect(payload.exp! - payload.iat!).toBe(DEFAULT_TTL_SECONDS);
  });

  it('assina com HS256', () => {
    const token = signToken(CLAIMS, SECRET);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    expect(header.alg).toBe('HS256');
  });

  it('verifica um token próprio (ida e volta)', () => {
    const verified = verifyToken(signToken(CLAIMS, SECRET), SECRET);
    expect(verified).toEqual(CLAIMS);
  });

  it('rejeita segredo errado', () => {
    const token = signToken(CLAIMS, SECRET);
    expect(() => verifyToken(token, 'outro-segredo')).toThrow();
  });

  it('rejeita issuer divergente', () => {
    const alheio = jwt.sign({ cpf: CLAIMS.cpf, role: CLAIMS.role }, SECRET, {
      algorithm: 'HS256', subject: CLAIMS.sub, issuer: 'monolito-antigo', expiresIn: 60,
    });
    expect(() => verifyToken(alheio, SECRET)).toThrow(/issuer/i);
  });

  it('rejeita token expirado', () => {
    const expirado = jwt.sign({ cpf: CLAIMS.cpf, role: CLAIMS.role }, SECRET, {
      algorithm: 'HS256', subject: CLAIMS.sub, issuer: DEFAULT_ISSUER, expiresIn: -10,
    });
    expect(() => verifyToken(expirado, SECRET)).toThrow(/expired/i);
  });

  it('rejeita token sem as claims obrigatórias', () => {
    const semClaims = jwt.sign({}, SECRET, {
      algorithm: 'HS256', issuer: DEFAULT_ISSUER, expiresIn: 60,
    });
    expect(() => verifyToken(semClaims, SECRET)).toThrow(/claims/);
  });

  it('respeita issuer e TTL customizados por ambiente', () => {
    process.env.JWT_ISSUER = 'custom-issuer';
    process.env.JWT_TTL_SECONDS = '120';
    const payload = jwt.decode(signToken(CLAIMS, SECRET)) as jwt.JwtPayload;
    expect(payload.iss).toBe('custom-issuer');
    expect(payload.exp! - payload.iat!).toBe(120);
  });
});
