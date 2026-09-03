import type { APIGatewayProxyEventV2, APIGatewayRequestAuthorizerEventV2 } from 'aws-lambda';
import { handleAuth } from './handlers/auth';
import { handleAuthorizer } from './handlers/authorizer';

/**
 * Entrypoint único: o API Gateway invoca a MESMA function para o POST /auth
 * (evento HTTP) e para o Lambda Authorizer (evento REQUEST). O despacho é
 * pelo formato do evento — eventos de authorizer trazem type: "REQUEST".
 */
export async function handler(
  event: APIGatewayProxyEventV2 | APIGatewayRequestAuthorizerEventV2,
): Promise<unknown> {
  if ('type' in event && event.type === 'REQUEST') {
    return handleAuthorizer(event);
  }
  return handleAuth(event as APIGatewayProxyEventV2);
}
