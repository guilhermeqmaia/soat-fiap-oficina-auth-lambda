import bcrypt from 'bcryptjs';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { authenticate } from '../application/authenticate';
import { findClienteByCpf, findUsuarioByCpf } from '../infrastructure/db';
import { signToken } from '../infrastructure/jwt';
import { log, logError } from '../infrastructure/logger';
import { getJwtSecret } from '../infrastructure/secrets';

/** Handler do POST /auth (evento HTTP payload 2.0 do API Gateway). */
export async function handleAuth(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  let input: unknown;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : event.body ?? '';
    input = raw === '' ? {} : JSON.parse(raw);
  } catch {
    return respond(400, { erro: 'Corpo da requisição não é um JSON válido' });
  }

  try {
    const result = await authenticate(input, {
      findClienteByCpf,
      findUsuarioByCpf,
      verifyPassword: (senha, hash) => bcrypt.compare(senha, hash),
      signToken: async (claims) => signToken(claims, await getJwtSecret()),
      log: (message, fields) => log(message, { ...fields, requestId: event.requestContext.requestId }),
    });
    return respond(result.statusCode, result.body);
  } catch (err) {
    logError('erro_interno_auth', {
      requestId: event.requestContext.requestId,
      erro: err instanceof Error ? err.message : String(err),
    });
    return respond(500, { erro: 'Erro interno' });
  }
}

function respond(statusCode: number, body: Record<string, unknown>): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
