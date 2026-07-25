import 'server-only';
import { checkRateLimitStrict } from '@/lib/rate-limit';
import { observabilityRateLimitKey } from '@/lib/observability/subject';

export async function checkObservabilityRateLimitStrict(
  purpose: string,
  uid: string,
  limit: number,
  windowMs: number,
) {
  try {
    return await checkRateLimitStrict(
      observabilityRateLimitKey(purpose, uid),
      limit,
      windowMs,
    );
  } catch {
    return {
      allowed: false,
      unavailable: true,
      remaining: 0,
      resetAt: Date.now() + windowMs,
    };
  }
}
