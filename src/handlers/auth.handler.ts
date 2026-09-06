import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { AuthError } from '../domain/errors';
import { maskCpf } from '../domain/cpf';
import { getContainer } from '../container';
import { errorResponse, HttpResponse, json } from '../shared/http';
import { Logger } from '../shared/logger';

type AuthEvent = Partial<APIGatewayProxyEventV2> & { cpf?: unknown };

/** Aceita o body do API Gateway (texto ou base64) e a invocacao direta `{ "cpf": "..." }`. */
export function parseBody(event: AuthEvent): { cpf?: unknown } {
  if (typeof event.body === 'string') {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    if (raw.trim() === '') return {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null ? (parsed as { cpf?: unknown }) : {};
    } catch {
      return {};
    }
  }
  if (event.cpf !== undefined) return { cpf: event.cpf };
  return {};
}

/**
 * `POST /auth` — valida o CPF, confere o cliente na base e devolve o JWT.
 * Contrato de erros: 400 sem CPF, 422 CPF invalido, 404 inexistente,
 * 403 inativo, 500 falha interna.
 */
export async function authHandler(event: AuthEvent, context?: Context): Promise<HttpResponse> {
  const requestId =
    event.requestContext?.requestId ?? context?.awsRequestId ?? 'local-' + Date.now().toString(36);

  let logger: Logger | undefined;
  try {
    const container = await getContainer();
    logger = container.logger.child({ requestId, route: 'POST /auth' });

    const { cpf } = parseBody(event);
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
