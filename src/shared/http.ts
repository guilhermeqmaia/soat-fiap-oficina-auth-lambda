export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function json(statusCode: number, body: unknown, requestId?: string): HttpResponse {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
    body: JSON.stringify(body),
  };
}

export function errorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId?: string,
): HttpResponse {
  return json(statusCode, { error: code, message, ...(requestId ? { requestId } : {}) }, requestId);
}
