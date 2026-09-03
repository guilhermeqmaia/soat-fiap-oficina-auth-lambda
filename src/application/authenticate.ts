import { isValidCpf, maskCpf, normalizeCpf } from '../domain/cpf';

/**
 * Caso de uso de autenticação (RFC-0003 do repo principal):
 *  - { cpf }         -> fluxo CLIENTE: existência na base basta
 *  - { cpf, senha }  -> fluxo STAFF: CPF associado ao usuário + senha
 * Dependências injetadas para manter o caso de uso testável sem AWS/banco.
 */

export interface ClienteRecord {
  id: string;
  nome: string;
}

export interface UsuarioRecord {
  id: string;
  nome: string;
  role: string;
  ativo: boolean;
  senhaHash: string;
}

export interface TokenClaims {
  sub: string;
  cpf: string;
  role: string;
}

export interface AuthenticateDeps {
  findClienteByCpf(cpf: string): Promise<ClienteRecord | null>;
  findUsuarioByCpf(cpf: string): Promise<UsuarioRecord | null>;
  verifyPassword(senha: string, hash: string): Promise<boolean>;
  signToken(claims: TokenClaims): Promise<string>;
  log(message: string, fields?: Record<string, unknown>): void;
}

export interface AuthenticateResult {
  statusCode: 200 | 400 | 403 | 404 | 422;
  body: Record<string, unknown>;
}

export async function authenticate(
  input: unknown,
  deps: AuthenticateDeps,
): Promise<AuthenticateResult> {
  const { cpf, senha } = (input ?? {}) as { cpf?: unknown; senha?: unknown };

  if (typeof cpf !== 'string' || cpf.trim() === '') {
    return { statusCode: 400, body: { erro: 'Informe o CPF no corpo da requisição' } };
  }
  if (!isValidCpf(cpf)) {
    deps.log('cpf_invalido', { cpf: maskCpf(cpf) });
    return { statusCode: 422, body: { erro: 'CPF inválido' } };
  }

  const cpfNormalizado = normalizeCpf(cpf);

  // Fluxo STAFF: presença de senha seleciona o fluxo (RFC-0003).
  if (senha !== undefined) {
    if (typeof senha !== 'string' || senha === '') {
      return { statusCode: 400, body: { erro: 'Senha inválida' } };
    }
    const usuario = await deps.findUsuarioByCpf(cpfNormalizado);
    if (!usuario) {
      deps.log('staff_nao_encontrado', { cpf: maskCpf(cpf) });
      return { statusCode: 404, body: { erro: 'Usuário não encontrado' } };
    }
    if (!usuario.ativo) {
      deps.log('staff_inativo', { cpf: maskCpf(cpf), usuarioId: usuario.id });
      return { statusCode: 403, body: { erro: 'Usuário inativo' } };
    }
    const senhaConfere = await deps.verifyPassword(senha, usuario.senhaHash);
    if (!senhaConfere) {
      deps.log('staff_senha_incorreta', { cpf: maskCpf(cpf), usuarioId: usuario.id });
      return { statusCode: 403, body: { erro: 'Credenciais inválidas' } };
    }
    const token = await deps.signToken({
      sub: usuario.id,
      cpf: cpfNormalizado,
      role: usuario.role,
    });
    deps.log('staff_autenticado', { cpf: maskCpf(cpf), usuarioId: usuario.id, role: usuario.role });
    return { statusCode: 200, body: { token } };
  }

  // Fluxo CLIENTE: só CPF.
  const cliente = await deps.findClienteByCpf(cpfNormalizado);
  if (!cliente) {
    deps.log('cliente_nao_encontrado', { cpf: maskCpf(cpf) });
    return { statusCode: 404, body: { erro: 'Cliente não encontrado' } };
  }
  // Nota: o schema atual não tem status/bloqueio de cliente — o 403 do
  // contrato fica reservado para quando o domínio ganhar esse estado.
  const token = await deps.signToken({
    sub: cliente.id,
    cpf: cpfNormalizado,
    role: 'CLIENTE',
  });
  deps.log('cliente_autenticado', { cpf: maskCpf(cpf), clienteId: cliente.id });
  return { statusCode: 200, body: { token } };
}
