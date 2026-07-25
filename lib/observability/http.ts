import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebase-admin';

export const OBSERVABILITY_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

export function observabilityJson(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  return NextResponse.json(body, {
    status: init.status,
    headers: { ...OBSERVABILITY_PRIVATE_HEADERS, ...init.headers },
  });
}

export function observabilityError(status: number, code: string, message: string) {
  return observabilityJson({ error: message, code }, { status });
}

export function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

export async function requireObservabilityUser(
  request: NextRequest,
): Promise<{ token: DecodedIdToken; error?: never } | { token?: never; error: NextResponse }> {
  const value = bearerToken(request);
  if (!value) {
    return { error: observabilityError(401, 'observability_auth_required', 'Sign in to continue.') };
  }
  try {
    const token = await getAdminAuth().verifyIdToken(value, true);
    if (!token.uid || token.uid.startsWith('anon:')) throw new Error('INVALID_SUBJECT');
    return { token };
  } catch {
    return {
      error: observabilityError(
        401,
        'observability_token_invalid',
        'Your session is invalid or expired.',
      ),
    };
  }
}

export async function readBoundedJson(
  request: NextRequest,
  maximumBytes: number,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; code: 'body_too_large' | 'body_invalid' }
> {
  const lengthHeader = request.headers.get('content-length');
  const declaredLength = Number(lengthHeader);
  if (lengthHeader && (!Number.isFinite(declaredLength) || declaredLength > maximumBytes)) {
    return { ok: false, code: 'body_too_large' };
  }
  if (!request.body) return { ok: false, code: 'body_invalid' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return { ok: false, code: 'body_too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, code: 'body_invalid' };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, code: 'body_invalid' };
  }
}

