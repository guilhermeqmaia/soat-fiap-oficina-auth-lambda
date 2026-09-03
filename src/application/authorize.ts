/**
 * Caso de uso do Lambda Authorizer: valida o Bearer token e devolve a
 * resposta simples do API Gateway (payload 2.0, enableSimpleResponses).
 */

export interface VerifiedToken {
  sub: string;
  cpf: string;
  role: string;
}

export interface AuthorizeDeps {
  verifyToken(token: string): Promise<VerifiedToken>;
  log(message: string, fields?: Record<string, unknown>): void;
}

export interface AuthorizeResult {
  isAuthorized: boolean;
  context?: Record<string, string>;
}

export async function authorize(
  authorizationHeader: string | undefined,
  deps: AuthorizeDeps,
): Promise<AuthorizeResult> {
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader ?? '');
  if (!match) {
    return { isAuthorized: false };
  }
  try {
    const claims = await deps.verifyToken(match[1]);
    return {
      isAuthorized: true,
      // Contexto chega ao backend em requestContext.authorizer.lambda.
      context: { sub: claims.sub, role: claims.role, cpf: claims.cpf },
    };
  } catch (err) {
    deps.log('token_rejeitado', { motivo: err instanceof Error ? err.message : 'desconhecido' });
    return { isAuthorized: false };
  }
}
