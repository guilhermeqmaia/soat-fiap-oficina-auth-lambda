import type { APIGatewayRequestAuthorizerEventV2, Context } from 'aws-lambda';
import { maskCpf } from '../domain/cpf';
import { getContainer } from '../container';
import { Logger } from '../shared/logger';

export interface AuthorizerResponse {
  isAuthorized: boolean;
  context?: Record<string, string>;
}

type AuthorizerEvent = Partial<APIGatewayRequestAuthorizerEventV2> & {
  authorizationToken?: string;
};

/** Extrai o token do header `Authorization: Bearer <jwt>` (case-insensitive). */
export function extractBearerToken(event: AuthorizerEvent): string | undefined {
  const fromIdentity = event.identitySource?.[0];
  const headers = event.headers ?? {};
  const headerValue =
    Object.entries(headers).find(([key]) => key.toLowerCase() === 'authorization')?.[1] ??
    event.authorizationToken;

  const raw = headerValue ?? fromIdentity;
  if (!raw) return undefined;

  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match?.[1]?.trim() ?? raw.trim();
}

/**
 * Lambda Authorizer (formato 2.0, simple response) das rotas sensiveis: valida
 * assinatura, `iss` e `exp` do JWT emitido por esta mesma function e devolve as
 * claims no contexto para o backend.
 */
export async function authorizerHandler(
  event: AuthorizerEvent,
  context?: Context,
): Promise<AuthorizerResponse> {
  const requestId = event.requestContext?.requestId ?? context?.awsRequestId ?? 'authorizer';
  let logger: Logger | undefined;

  try {
    const container = await getContainer();
    logger = container.logger.child({ requestId, route: 'authorizer' });

    const token = extractBearerToken(event);
    if (!token) {
      logger.warn('Authorizer negou: token ausente');
      return { isAuthorized: false };
    }

    const claims = await container.tokens.verify(token);
    logger.info('Authorizer autorizou', {
      clienteId: claims.sub,
      cpf: maskCpf(claims.cpf),
      role: claims.role,
    });

    return {
      isAuthorized: true,
      context: {
        clienteId: claims.sub,
        role: claims.role,
        cpf: claims.cpf,
        nome: claims.nome,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Sem fallback, uma falha de bootstrap (getContainer) negaria TODAS as
    // rotas protegidas sem deixar uma unica linha de log no CloudWatch.
    const fallback = logger ?? new Logger('error', { requestId, route: 'authorizer' });
    fallback.warn('Authorizer negou', { erro: message });
    return { isAuthorized: false };
  }
}
