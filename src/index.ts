import type { Context } from 'aws-lambda';
import { authHandler } from './handlers/auth.handler';
import { authorizerHandler, AuthorizerResponse } from './handlers/authorizer.handler';
import { HttpResponse } from './shared/http';

export { authHandler as auth } from './handlers/auth.handler';
export { authorizerHandler as authorizer } from './handlers/authorizer.handler';

type LambdaEvent = Record<string, unknown>;

/** Evento de Lambda Authorizer (REQUEST, payload 2.0) tem `type` e `routeArn`. */
export function isAuthorizerEvent(event: LambdaEvent): boolean {
  return event['type'] === 'REQUEST' || typeof event['routeArn'] === 'string';
}

/**
 * Entrada unica da function: o API Gateway usa o mesmo ARN para a rota publica
 * `POST /auth` (integracao AWS_PROXY) e para o Lambda Authorizer das rotas
 * sensiveis, entao o despacho e feito pelo formato do evento.
 */
export async function handler(
  event: LambdaEvent,
  context?: Context,
): Promise<HttpResponse | AuthorizerResponse> {
  if (isAuthorizerEvent(event)) {
    return authorizerHandler(event, context);
  }
  return authHandler(event, context);
}
