import jwt from 'jsonwebtoken';
import { TokenClaims } from '../application/authenticate';
import { VerifiedToken } from '../application/authorize';

/**
 * Assinatura/validação HS256 com segredo compartilhado com o monólito
 * (RFC-0003). Issuer e TTL configuráveis por ambiente.
 */

export const DEFAULT_ISSUER = 'oficina-auth-lambda';
export const DEFAULT_TTL_SECONDS = 3600;

function issuer(): string {
  return process.env.JWT_ISSUER ?? DEFAULT_ISSUER;
}

function ttlSeconds(): number {
  const parsed = Number(process.env.JWT_TTL_SECONDS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_SECONDS;
}

export function signToken(claims: TokenClaims, secret: string): string {
  return jwt.sign(
    { cpf: claims.cpf, role: claims.role },
    secret,
    {
      algorithm: 'HS256',
      subject: claims.sub,
      issuer: issuer(),
      expiresIn: ttlSeconds(),
    },
  );
}

export function verifyToken(token: string, secret: string): VerifiedToken {
  const payload = jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: issuer(),
  }) as jwt.JwtPayload;

  if (!payload.sub || typeof payload.cpf !== 'string' || typeof payload.role !== 'string') {
    throw new Error('claims obrigatórias ausentes');
  }
  return { sub: payload.sub, cpf: payload.cpf, role: payload.role };
}
