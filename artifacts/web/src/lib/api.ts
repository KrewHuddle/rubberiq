/**
 * Tiny fetch wrapper — adds bearer + JSON headers, throws on non-2xx.
 */
import { loadToken, clearPrincipal } from '../principal.js';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = loadToken();
  const headers = new Headers(init.headers ?? {});
  headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearPrincipal();
    location.href = '/sign-in';
    throw new ApiError(401, null, 'unauthorized');
  }
  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: string }).error)
        : `http_${res.status}`;
    throw new ApiError(res.status, body, msg);
  }
  return body as T;
}
