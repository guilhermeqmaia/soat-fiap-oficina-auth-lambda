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

/** Staff da oficina (ADMIN/ATENDENTE/MECANICO/ESTOQUISTA) — fluxo CPF + senha. */
export interface Usuario {
  id: string;
  nome: string;
  cpf: string;
  role: string;
  ativo: boolean;
  senhaHash: string;
}

export interface UsuarioRepository {
  findByCpf(cpf: string): Promise<Usuario | null>;
}

export interface PasswordVerifier {
  verify(senha: string, hash: string): Promise<boolean>;
}

/** Campos minimos que o emissor de token precisa do autenticado. */
export type TokenSubject = Pick<Cliente, 'id' | 'nome' | 'cpf'>;

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
  issue(input: { cliente: TokenSubject; role: string }): Promise<IssuedToken>;
  verify(token: string): Promise<AccessTokenClaims>;
}
