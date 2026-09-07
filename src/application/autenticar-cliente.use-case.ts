import { isValidCpf, normalizeCpf } from '../domain/cpf';
import {
  ClienteInativoError,
  ClienteNaoEncontradoError,
  InvalidCpfError,
  MissingCpfError,
} from '../domain/errors';
import { ClienteRepository, IssuedToken, TokenIssuer } from './ports';

export interface AutenticarClienteInput {
  cpf?: unknown;
}

export interface AutenticarClienteOutput {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  cliente: { id: string; nome: string; cpf: string; role: string };
}

/**
 * Fluxo unico da funcao serverless (US-F3-01):
 * 1. valida o CPF (formato + digitos verificadores);
 * 2. consulta existencia e status do cliente na base;
 * 3. emite o JWT consumido pelas APIs protegidas.
 */
export class AutenticarClienteUseCase {
  constructor(
    private readonly clientes: ClienteRepository,
    private readonly tokens: TokenIssuer,
    private readonly clienteRole: string,
  ) {}

  async execute(input: AutenticarClienteInput): Promise<AutenticarClienteOutput> {
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

    const cliente = await this.clientes.findByCpf(cpf);
    if (!cliente) {
      throw new ClienteNaoEncontradoError();
    }
    if (!cliente.ativo) {
      throw new ClienteInativoError(cliente.status);
    }

    const issued: IssuedToken = await this.tokens.issue({
      cliente: { ...cliente, cpf },
      role: this.clienteRole,
    });

    return {
      accessToken: issued.token,
      tokenType: issued.tokenType,
      expiresAt: issued.expiresAt,
      cliente: { id: cliente.id, nome: cliente.nome, cpf, role: issued.claims.role },
    };
  }
}
