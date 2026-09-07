/**
 * Erros de dominio da autenticacao. O `status` de cada erro e o contrato HTTP
 * do `POST /auth` definido na US-F3-01.
 */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Body ausente/ilegivel ou campo `cpf` faltando. */
export class MissingCpfError extends AuthError {
  constructor() {
    super(400, 'CPF_AUSENTE', 'Informe o campo "cpf" no corpo da requisicao.');
  }
}

/** CPF presente, mas invalido (formato ou digitos verificadores). */
export class InvalidCpfError extends AuthError {
  constructor() {
    super(422, 'CPF_INVALIDO', 'CPF invalido.');
  }
}

export class ClienteNaoEncontradoError extends AuthError {
  constructor() {
    super(404, 'CLIENTE_NAO_ENCONTRADO', 'Cliente nao encontrado para o CPF informado.');
  }
}

export class ClienteInativoError extends AuthError {
  constructor(readonly clienteStatus: string) {
    super(403, 'CLIENTE_INATIVO', 'Cliente inativo ou bloqueado.');
  }
}

/** Fluxo staff (CPF + senha — RFC-0003): campo `senha` vazio ou nao-string. */
export class MissingSenhaError extends AuthError {
  constructor() {
    super(400, 'SENHA_AUSENTE', 'Informe o campo "senha" para autenticacao de staff.');
  }
}

export class UsuarioNaoEncontradoError extends AuthError {
  constructor() {
    super(404, 'USUARIO_NAO_ENCONTRADO', 'Usuario nao encontrado para o CPF informado.');
  }
}

export class UsuarioInativoError extends AuthError {
  constructor() {
    super(403, 'USUARIO_INATIVO', 'Usuario inativo.');
  }
}

/** Senha incorreta — mensagem generica de proposito (nao revela qual credencial falhou). */
export class CredenciaisInvalidasError extends AuthError {
  constructor() {
    super(403, 'CREDENCIAIS_INVALIDAS', 'Credenciais invalidas.');
  }
}
