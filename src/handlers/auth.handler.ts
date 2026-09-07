import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { AuthError } from '../domain/errors';
import { maskCpf } from '../domain/cpf';
import { getContainer } from '../container';
import { errorResponse, HttpResponse, json } from '../shared/http';
import { Logger } from '../shared/logger';

type AuthEvent = Partial<APIGatewayProxyEventV2> & { cpf?: unknown; senha?: unknown };

interface AuthBody {
  cpf?: unknown;
  senha?: unknown;
}

/** Aceita o body do API Gateway (texto ou base64) e a invocacao direta `{ "cpf": "..." }`. */
export function parseBody(event: AuthEvent): AuthBody {
  if (typeof event.body === 'string') {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    if (raw.trim() === '') return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null ? (parsed as AuthBody) : {};
    } catch {
      return {};
    }
  }
  if (event.cpf !== undefined) {
    return event.senha !== undefined ? { cpf: event.cpf, senha: event.senha } : { cpf: event.cpf };
  }
  return {};
}

/**
 * `POST /auth` — valida o CPF, confere o autenticado na base e devolve o JWT.
 * A presenca de `senha` seleciona o fluxo (RFC-0003): `{cpf}` = cliente;
 * `{cpf, senha}` = staff (role do usuario no token).
 * Contrato de erros: 400 entrada ausente, 422 CPF invalido, 404 inexistente,
 * 403 inativo/credenciais, 500 falha interna.
 */
export async function authHandler(event: AuthEvent, context?: Context): Promise<HttpResponse> {
  const requestId =
    event.requestContext?.requestId ?? context?.awsRequestId ?? 'local-' + Date.now().toString(36);

  let logger: Logger | undefined;
  try {
    const container = await getContainer();
    const { cpf, senha } = parseBody(event);
    const fluxo = senha !== undefined ? 'staff' : 'cliente';
    logger = container.logger.child({ requestId, route: 'POST /auth', fluxo });

    if (senha !== undefined) {
      const result = await container.autenticarStaff.execute({ cpf, senha });
      logger.info('Autenticacao staff concluida', {
        cpf: maskCpf(result.usuario.cpf),
        usuarioId: result.usuario.id,
        role: result.usuario.role,
        status: 200,
      });
      return json(
        200,
        {
          accessToken: result.accessToken,
          tokenType: result.tokenType,
          expiresAt: result.expiresAt,
          usuario: {
            id: result.usuario.id,
            nome: result.usuario.nome,
            cpf: maskCpf(result.usuario.cpf),
            role: result.usuario.role,
          },
        },
        requestId,
      );
    }

    const result = await container.autenticarCliente.execute({ cpf });

    logger.info('Autenticacao concluida', {
      cpf: maskCpf(result.cliente.cpf),
      clienteId: result.cliente.id,
      status: 200,
    });

    return json(
      200,
      {
        accessToken: result.accessToken,
        tokenType: result.tokenType,
        expiresAt: result.expiresAt,
        cliente: {
          id: result.cliente.id,
          nome: result.cliente.nome,
          cpf: maskCpf(result.cliente.cpf),
          role: result.cliente.role,
        },
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof AuthError) {
      logger?.warn('Autenticacao recusada', { code: error.code, status: error.status });
      return errorResponse(error.status, error.code, error.message, requestId);
    }
    const message = error instanceof Error ? error.message : String(error);
    const fallback = logger ?? new Logger('error', { requestId });
    fallback.error('Falha interna na autenticacao', { erro: message });
    return errorResponse(500, 'ERRO_INTERNO', 'Erro interno ao autenticar.', requestId);
  }
}
