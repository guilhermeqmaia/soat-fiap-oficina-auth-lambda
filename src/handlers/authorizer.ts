import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';
import { authorize } from '../application/authorize';
import { verifyToken } from '../infrastructure/jwt';
import { log } from '../infrastructure/logger';
import { getJwtSecret } from '../infrastructure/secrets';

type SimpleResult = APIGatewaySimpleAuthorizerWithContextResult<Record<string, string>>;

/**
 * Handler do Lambda Authorizer (REQUEST, payload 2.0, simple responses).
 * Nunca lança: qualquer falha vira isAuthorized=false (401 na borda).
 */
export async function handleAuthorizer(
  event: APIGatewayRequestAuthorizerEventV2,
): Promise<SimpleResult> {
  // identitySource[0] = header Authorization (configurado no gateway).
  const header = event.identitySource?.[0] ?? event.headers?.authorization;
  const result = await authorize(header, {
    verifyToken: async (token) => verifyToken(token, await getJwtSecret()),
    log,
  });
  return { isAuthorized: result.isAuthorized, context: result.context ?? {} };
}
