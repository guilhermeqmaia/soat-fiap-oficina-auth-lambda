/** Portas da camada de aplicacao (implementadas em `src/infra`). */

export interface Cliente {
  id: string;
  nome: string;
  cpf: string;
  /** Status bruto lido do banco (`ATIVO` quando a base nao tem a coluna). */
  status: string;
  ativo: boolean;
}

export interface ClienteRepository {
  findByCpf(cpf: string): Promise<Cliente | null>;
}

export interface AccessTokenClaims {
  sub: string;
  cpf: string;
  nome: string;
  role: string;
  iss: string;
  aud?: string;
  iat: number;
  exp: number;
}

export interface IssuedToken {
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
  claims: AccessTokenClaims;
}

export interface TokenIssuer {
  issue(input: { cliente: Cliente; role: string }): Promise<IssuedToken>;
  verify(token: string): Promise<AccessTokenClaims>;
}
