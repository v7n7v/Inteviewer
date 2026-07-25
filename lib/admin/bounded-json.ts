import type { NextRequest } from 'next/server';

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; code: 'BODY_TOO_LARGE' | 'INVALID_JSON' };

export async function readBoundedJson(
  request: NextRequest,
  maxBytes = 8_192,
): Promise<BoundedJsonResult> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, code: 'BODY_TOO_LARGE' };
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return { ok: false, code: 'INVALID_JSON' };
  }
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    return { ok: false, code: 'BODY_TOO_LARGE' };
  }

  try {
    return { ok: true, value: JSON.parse(body) };
  } catch {
    return { ok: false, code: 'INVALID_JSON' };
  }
}
