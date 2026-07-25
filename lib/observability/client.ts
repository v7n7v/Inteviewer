'use client';

import { authFetch } from '@/lib/auth-fetch';

interface ConsentPolicyResponse {
  policy?: {
    noticeVersion?: string;
    collectionEnabled?: boolean;
  };
  error?: string;
}

interface DiagnosticCaseResponse {
  case?: {
    caseId?: string;
    grantState?: string;
    grantExpiresAt?: string | null;
  };
  error?: string;
}

export interface ProductObservabilityEvent {
  schemaVersion: 1;
  purpose: 'product_analytics';
  producer: 'product_tool';
  eventName: 'tool_completed';
  operationId: string;
  category: 'tool_usage';
  action: 'complete';
  outcome: 'success' | 'degraded';
  plan: 'free' | 'pro' | 'studio' | 'unknown';
  tool?: 'resume_check' | 'job_match' | 'career_check' | 'writing_trust'
    | 'quick_polish' | 'resume_builder' | 'ai_humanizer' | 'ai_detector'
    | 'interview_prep' | 'taco';
  latencyBand?: 'under_250ms' | '250ms_1s' | '1s_3s' | 'over_3s' | 'unknown';
  sizeBand?: 'empty' | 'small' | 'medium' | 'large' | 'unknown';
  quotaBand?: 'available' | 'near_limit' | 'exhausted' | 'unlimited' | 'unknown';
}

export async function sendProductObservabilityEvent(
  event: ProductObservabilityEvent,
): Promise<boolean> {
  try {
    const response = await authFetch('/api/observability/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [event] }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function createPrivacySafeBugDiagnosticCase(): Promise<{
  caseId: string;
  grantExpiresAt: string | null;
}> {
  const noticeVersion = await readPrivacySafeDiagnosticNoticeVersion();
  const caseResponse = await authFetch('/api/observability/diagnostic-cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'tool_failure',
      shareDiagnostics: true,
      noticeVersion,
    }),
  });
  const casePayload = await caseResponse.json().catch(() => ({})) as DiagnosticCaseResponse;
  const caseId = casePayload.case?.caseId;
  if (!caseResponse.ok || typeof caseId !== 'string') {
    throw new Error(casePayload.error || 'Privacy-safe diagnostics could not be attached.');
  }
  return {
    caseId,
    grantExpiresAt: typeof casePayload.case?.grantExpiresAt === 'string'
      ? casePayload.case.grantExpiresAt
      : null,
  };
}

export async function readPrivacySafeDiagnosticNoticeVersion(): Promise<string> {
  const consentResponse = await authFetch('/api/observability/consent', {
    cache: 'no-store',
  });
  const consentPayload = await consentResponse.json().catch(() => ({})) as ConsentPolicyResponse;
  if (!consentResponse.ok) {
    throw new Error(consentPayload.error || 'Privacy-safe diagnostics are unavailable.');
  }
  const noticeVersion = consentPayload.policy?.noticeVersion;
  if (
    consentPayload.policy?.collectionEnabled !== true
    || typeof noticeVersion !== 'string'
  ) {
    throw new Error('Privacy-safe diagnostics are not enabled yet.');
  }
  return noticeVersion;
}
