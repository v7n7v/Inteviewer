/**
 * API Route Auth Helper
 * Extracts and verifies Firebase ID token from the Authorization header.
 * Tier-aware rate limiting using pricing-tiers config.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from './firebase-admin';
import { checkRateLimit } from './rate-limit';
import { getUserTier, getRateLimit as getTierRateLimit } from './pricing-tiers';

interface AuthResult {
  uid: string;
  email?: string;
  tier: 'free' | 'pro';
}

/**
 * Authenticate an API request by verifying the Firebase ID token.
 */
export async function authenticateRequest(req: NextRequest): Promise<Omit<AuthResult, 'tier'> | null> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) return null;

  const decoded = await verifyIdToken(token);
  if (!decoded) return null;

  return {
    uid: decoded.uid,
    email: decoded.email,
  };
}

/**
 * Guard an API route — checks auth, determines tier, applies tier-aware rate limits.
 * Usage:
 *   const guard = await guardApiRoute(req);
 *   if (guard.error) return guard.error;
 *   const { user } = guard; // user.tier is 'free' or 'pro'
 */
export async function guardApiRoute(
  req: NextRequest,
  options?: { rateLimit?: number; rateLimitWindow?: number }
): Promise<{ user: AuthResult; error?: never } | { user?: never; error: NextResponse }> {

  // Auth check first
  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required. Please sign in.' },
        { status: 401 }
      ),
    };
  }

  // Get user tier from Firestore (master emails auto-promoted)
  const tier = await getUserTier(authUser.uid, authUser.email);

  // Determine rate limit: use tier-aware config or fallback to explicit options
  const pathname = new URL(req.url).pathname;
  const limit = options?.rateLimit ?? getTierRateLimit(pathname, tier);

  // Rate limiting by IP + UID combo
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';

  const rateLimitKey = `${ip}:${authUser.uid}`;

  const { allowed, remaining, resetIn } = checkRateLimit(
    rateLimitKey,
    limit,
    options?.rateLimitWindow ?? 60_000
  );

  if (!allowed) {
    const upgradeMsg = tier === 'free'
      ? 'Unlock 3x more with Pro — $2.99/mo'
      : 'Pro rate limit reached. Please wait a moment.';

    return {
      error: NextResponse.json(
        {
          error: 'Rate limit reached. Please wait a moment before trying again.',
          upgrade: upgradeMsg,
          tier,
          retryAfter: Math.ceil(resetIn / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(resetIn / 1000)),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Tier': tier,
          },
        }
      ),
    };
  }

  return {
    user: {
      ...authUser,
      tier,
    },
  };
}
