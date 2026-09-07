import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { AccessTokenClaims, Cliente, IssuedToken, TokenIssuer } from '../application/ports';
import { Config } from '../config/env';

/**
 * Emite e valida o JWT (HS256) com o segredo compartilhado com o monolito, que
 * atua como resource server (US-F3-03) e confere `iss` e `exp`.
 */
export class JwtTokenIssuer implements TokenIssuer {
  constructor(
    private readonly secret: string,
    private readonly config: Config,
  ) {}

  async issue({ cliente, role }: { cliente: Cliente; role: string }): Promise<IssuedToken> {
    const options: SignOptions = {
      algorithm: 'HS256',
      expiresIn: this.config.jwtExpiresIn as NonNullable<SignOptions['expiresIn']>,
      issuer: this.config.jwtIssuer,
      subject: cliente.id,
    };
    if (this.config.jwtAudience) options.audience = this.config.jwtAudience;

    const token = jwt.sign({ cpf: cliente.cpf, nome: cliente.nome, role }, this.secret, options);
    const claims = this.decode(token);

    return {
      token,
      tokenType: 'Bearer',
      expiresAt: new Date(claims.exp * 1000).toISOString(),
      claims,
    };
  }

  async verify(token: string): Promise<AccessTokenClaims> {
    const payload = jwt.verify(token, this.secret, {
      algorithms: ['HS256'],
      issuer: this.config.jwtIssuer,
      ...(this.config.jwtAudience ? { audience: this.config.jwtAudience } : {}),
    });
    if (typeof payload === 'string') {
      throw new Error('Token com payload nao-JSON.');
    }
    return toClaims(payload);
  }

  private decode(token: string): AccessTokenClaims {
    return toClaims(jwt.decode(token) as JwtPayload);
  }
}

function toClaims(payload: JwtPayload): AccessTokenClaims {
  const claims: AccessTokenClaims = {
    sub: String(payload.sub ?? ''),
    cpf: String(payload['cpf'] ?? ''),
    nome: String(payload['nome'] ?? ''),
    role: String(payload['role'] ?? ''),
    iss: String(payload.iss ?? ''),
    iat: Number(payload.iat ?? 0),
    exp: Number(payload.exp ?? 0),
  };
  if (payload.aud) claims.aud = String(payload.aud);
  return claims;
}
