import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';
import { checkRateLimitStrict } from '@/lib/rate-limit';
import { runSonaActivationProof } from '@/lib/assistant/activation-proof';
import { createSonaActivationReceipt } from '@/lib/assistant/activation-receipt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};

const localEmergencyWindows = new Map<string, { count: number; resetAt: number }>();

function passLocalEmergencyLimit(key: string, now = Date.now()) {
  const current = localEmergencyWindows.get(key);
  if (!current || current.resetAt <= now) {
    localEmergencyWindows.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : undefined;
}

export async function POST(req: NextRequest) {
  const authenticated = await authenticateRequest(req);
  if (!authenticated) {
    return response(
      { status: 'blocked', code: 'AUTH_REQUIRED', error: 'Sign in to preview Taco activation.' },
      401,
    );
  }

  if (!passLocalEmergencyLimit(`sona-preflight:${authenticated.uid}`)) {
    return response(
      { status: 'blocked', code: 'RATE_LIMITED', error: 'Wait a moment before refreshing this preview.' },
      429,
    );
  }

  const strictLimit = await checkRateLimitStrict(
    `sona-preflight:${authenticated.uid}`,
    3,
    60_000,
  );
  if (strictLimit.unavailable) {
    return response(
      { status: 'blocked', code: 'RATE_LIMIT_UNAVAILABLE', error: 'The secure preview limit is unavailable.' },
      503,
    );
  }
  if (!strictLimit.allowed) {
    return response(
      { status: 'blocked', code: 'RATE_LIMITED', error: 'Wait a moment before refreshing this preview.' },
      429,
    );
  }

  const guard = await guardApiRoute(req, {
    rateLimit: 3,
    rateLimitWindow: 60_000,
    skipUsageCap: true,
  });
  if (guard.error) return guard.error;

  let raw: Record<string, unknown>;
  try {
    raw = await req.json() as Record<string, unknown>;
  } catch {
    return response(
      { status: 'blocked', code: 'INVALID_TARGET_BRIEF', error: 'The target brief could not be read.' },
      400,
    );
  }

  const input = {
    tier: guard.user.tier,
    resumeVersionId: cleanText(raw.resumeVersionId, 180),
    targetRole: cleanText(raw.targetRole, 160),
    location: cleanText(raw.location, 160),
    salaryTarget: typeof raw.salaryTarget === 'number' ? raw.salaryTarget : undefined,
    remotePreference: raw.remotePreference === 'remote'
      || raw.remotePreference === 'hybrid'
      || raw.remotePreference === 'onsite'
      || raw.remotePreference === 'any'
      ? raw.remotePreference
      : undefined,
  } as const;

  try {
    const result = await runSonaActivationProof(
      getAdminDb(),
      guard.user.uid,
      input,
    );
    const activationReceipt = result.generation.preparationReady
      && result.canScout
      && result.resume.id
      ? createSonaActivationReceipt({
          uid: guard.user.uid,
          resumeVersionId: result.resume.id,
          targetRole: result.target.role,
          location: result.target.location,
          salaryTarget: result.target.salaryTarget,
          remotePreference: result.target.remotePreference,
        })
      : undefined;
    const unavailableSupply = result.code === 'SAFE_SUPPLY_UNAVAILABLE';
    const noSafeResults = result.code === 'INSUFFICIENT_SAFE_RESULTS';
    return response(
      {
        ...result,
        ...(activationReceipt ? { activationReceipt } : {}),
      },
      unavailableSupply ? 503 : noSafeResults ? 422 : 200,
    );
  } catch (error) {
    monitor.critical('Taco activation preflight failed', String(error));
    return response(
      {
        status: 'blocked',
        code: 'ACTIVATION_PROOF_FAILED',
        error: 'Taco could not verify this preview. No quota or external action was used.',
      },
      503,
    );
  }
}
