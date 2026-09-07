import { isValidCpf, normalizeCpf } from '../domain/cpf';
import {
  CredenciaisInvalidasError,
  InvalidCpfError,
  MissingCpfError,
  MissingSenhaError,
  UsuarioInativoError,
  UsuarioNaoEncontradoError,
} from '../domain/errors';
import { IssuedToken, PasswordVerifier, TokenIssuer, UsuarioRepository } from './ports';

export interface AutenticarStaffInput {
  cpf?: unknown;
  senha?: unknown;
}

export interface AutenticarStaffOutput {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  usuario: { id: string; nome: string; cpf: string; role: string };
}

/**
 * Fluxo staff da funcao serverless (RFC-0003, sancionado pelo professor no
 * forum): ADMIN/ATENDENTE/MECANICO/ESTOQUISTA autenticam com **CPF + senha**,
 * com o CPF validado e associado ao usuario. A role emitida no token e a do
 * proprio usuario.
 *
 * Dependencia de schema: a coluna `usuario.cpf` nasce na migration da
 * US-F3-03 (repo da aplicacao, dono do schema).
 */
export class AutenticarStaffUseCase {
  constructor(
    private readonly usuarios: UsuarioRepository,
    private readonly senhas: PasswordVerifier,
    private readonly tokens: TokenIssuer,
  ) {}

  async execute(input: AutenticarStaffInput): Promise<AutenticarStaffOutput> {
    const rawCpf = input.cpf;
    if (rawCpf === undefined || rawCpf === null || rawCpf === '') {
      throw new MissingCpfError();
    }
    if (typeof rawCpf !== 'string' && typeof rawCpf !== 'number') {
      throw new InvalidCpfError();
    }
    const cpf = normalizeCpf(String(rawCpf));
    if (!isValidCpf(cpf)) {
      throw new InvalidCpfError();
    }

    if (typeof input.senha !== 'string' || input.senha === '') {
      throw new MissingSenhaError();
    }

    const usuario = await this.usuarios.findByCpf(cpf);
    if (!usuario) {
      throw new UsuarioNaoEncontradoError();
    }
    if (!usuario.ativo) {
      throw new UsuarioInativoError();
    }
    const senhaConfere = await this.senhas.verify(input.senha, usuario.senhaHash);
    if (!senhaConfere) {
      throw new CredenciaisInvalidasError();
    }

    const issued: IssuedToken = await this.tokens.issue({
      cliente: { id: usuario.id, nome: usuario.nome, cpf },
      role: usuario.role,
    });

    return {
      accessToken: issued.token,
      tokenType: issued.tokenType,
      expiresAt: issued.expiresAt,
      usuario: { id: usuario.id, nome: usuario.nome, cpf, role: issued.claims.role },
    };
  }
}
