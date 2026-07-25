import { NextResponse } from 'next/server';
import type { AdminResponseMeta } from '@/lib/admin/contracts';

export const ADMIN_PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  Vary: 'Authorization',
  'X-Content-Type-Options': 'nosniff',
} as const;

export function adminResponseMeta(input: Partial<Omit<AdminResponseMeta, 'requestId'>> = {}): AdminResponseMeta {
  return {
    requestId: crypto.randomUUID(),
    generatedAt: input.generatedAt || new Date().toISOString(),
    staleAfterMs: input.staleAfterMs ?? 60_000,
    partial: input.partial ?? false,
    truncated: input.truncated ?? false,
  };
}

export function adminJson<T>(body: T, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, {
    status: init.status,
    headers: {
      ...ADMIN_PRIVATE_HEADERS,
      ...init.headers,
    },
  });
}

export function adminReadFailure(
  code: string,
  message: string,
  status = 503,
  retryAfterSeconds?: number,
) {
  return adminJson(
    {
      error: message,
      code,
      state: 'unknown' as const,
      retryable: status >= 500 || status === 429,
      meta: adminResponseMeta({
        staleAfterMs: 0,
        partial: true,
        truncated: false,
      }),
    },
    {
      status,
      headers: retryAfterSeconds
        ? { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) }
        : undefined,
    },
  );
}
