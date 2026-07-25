import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  OBSERVABILITY_MAX_BATCH_SIZE,
  OBSERVABILITY_MAX_EVENT_BYTES,
} from '@/lib/observability/config';

export const OBSERVABILITY_SCHEMA_VERSION = 1 as const;

export const observabilityPurposes = [
  'service_reliability',
  'product_analytics',
] as const;

export const observabilityTools = [
  'resume_check',
  'job_match',
  'career_check',
  'writing_trust',
  'quick_polish',
  'resume_builder',
  'ai_humanizer',
  'ai_detector',
  'interview_prep',
  'taco',
] as const;

export const observabilityPlanSnapshots = ['free', 'pro', 'studio', 'unknown'] as const;
export const observabilityLatencyBands = ['under_250ms', '250ms_1s', '1s_3s', 'over_3s', 'unknown'] as const;
export const observabilitySizeBands = ['empty', 'small', 'medium', 'large', 'unknown'] as const;
export const observabilityQuotaBands = ['available', 'near_limit', 'exhausted', 'unlimited', 'unknown'] as const;
export const observabilityErrorCodes = [
  'validation_rejected',
  'quota_exhausted',
  'dependency_unavailable',
  'timeout',
  'internal_failure',
] as const;

const operationIdSchema = z.string()
  .min(12)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const toolCompletedSchema = z.object({
  schemaVersion: z.literal(OBSERVABILITY_SCHEMA_VERSION),
  purpose: z.literal('product_analytics'),
  producer: z.literal('product_tool'),
  eventName: z.literal('tool_completed'),
  operationId: operationIdSchema,
  category: z.literal('tool_usage'),
  tool: z.enum(observabilityTools),
  action: z.literal('complete'),
  outcome: z.enum(['success', 'degraded']),
  plan: z.enum(observabilityPlanSnapshots),
  latencyBand: z.enum(observabilityLatencyBands),
  sizeBand: z.enum(observabilitySizeBands),
  quotaBand: z.enum(observabilityQuotaBands),
}).strict();

const toolFailedSchema = z.object({
  schemaVersion: z.literal(OBSERVABILITY_SCHEMA_VERSION),
  purpose: z.literal('service_reliability'),
  producer: z.literal('product_tool_server'),
  eventName: z.literal('tool_failed'),
  operationId: operationIdSchema,
  category: z.literal('reliability'),
  tool: z.enum(observabilityTools),
  action: z.literal('complete'),
  outcome: z.literal('failure'),
  plan: z.enum(observabilityPlanSnapshots),
  latencyBand: z.enum(observabilityLatencyBands),
  errorCode: z.enum(observabilityErrorCodes),
}).strict();

const feedbackAcceptedSchema = z.object({
  schemaVersion: z.literal(OBSERVABILITY_SCHEMA_VERSION),
  purpose: z.literal('service_reliability'),
  producer: z.literal('feedback_server'),
  eventName: z.literal('feedback_accepted'),
  operationId: operationIdSchema,
  category: z.literal('support'),
  action: z.literal('submit'),
  outcome: z.literal('success'),
  plan: z.enum(observabilityPlanSnapshots),
}).strict();

export const observabilityEventSchema = z.discriminatedUnion('eventName', [
  toolCompletedSchema,
  toolFailedSchema,
  feedbackAcceptedSchema,
]);

export const observabilityEventBatchSchema = z.object({
  events: z.array(observabilityEventSchema).min(1).max(OBSERVABILITY_MAX_BATCH_SIZE),
}).strict();

export type ObservabilityEventInput = z.infer<typeof observabilityEventSchema>;
export type ObservabilityPurpose = ObservabilityEventInput['purpose'];
export type ObservabilityEventName = ObservabilityEventInput['eventName'];

const FORBIDDEN_KEYS = new Set([
  'uid',
  'email',
  'phone',
  'name',
  'prompt',
  'response',
  'resume',
  'coverletter',
  'jobdescription',
  'filename',
  'title',
  'company',
  'searchterm',
  'query',
  'url',
  'uri',
  'ip',
  'useragent',
  'token',
  'secret',
  'password',
  'credential',
  'providerid',
  'stack',
  'raw',
  'content',
  'metadata',
  'timestamp',
  'occurredat',
  'clienttimestamp',
]);
const FORBIDDEN_VALUE = /(?:https?:\/\/|Bearer\s+[A-Za-z0-9._~-]+|sk_(?:live|test)_[A-Za-z0-9]+|AIza[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+?\d[\d\s().-]{8,}\d)/i;

function scanForForbiddenData(value: unknown, key = '', depth = 0): boolean {
  if (depth > 4) return true;
  if (key && FORBIDDEN_KEYS.has(key.replace(/[^a-z0-9]/gi, '').toLowerCase())) return true;
  if (typeof value === 'string') return FORBIDDEN_VALUE.test(value);
  if (Array.isArray(value)) return value.some(item => scanForForbiddenData(item, '', depth + 1));
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>)
    .some(([childKey, child]) => scanForForbiddenData(child, childKey, depth + 1));
}

export type ObservabilityValidationResult =
  | { ok: true; value: ObservabilityEventInput; fingerprint: string }
  | { ok: false; code: 'schema_invalid' | 'forbidden_data' | 'event_too_large' };

export function validateObservabilityEvent(value: unknown): ObservabilityValidationResult {
  if (scanForForbiddenData(value)) return { ok: false, code: 'forbidden_data' };
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { ok: false, code: 'schema_invalid' };
  }
  if (Buffer.byteLength(serialized, 'utf8') > OBSERVABILITY_MAX_EVENT_BYTES) {
    return { ok: false, code: 'event_too_large' };
  }
  const parsed = observabilityEventSchema.safeParse(value);
  if (!parsed.success) return { ok: false, code: 'schema_invalid' };
  const canonical = JSON.stringify(parsed.data);
  return {
    ok: true,
    value: parsed.data,
    fingerprint: createHash('sha256').update(canonical).digest('hex'),
  };
}

export function validateObservabilityBatch(value: unknown):
  | { ok: true; events: ObservabilityEventInput[] }
  | { ok: false; code: 'batch_invalid' | 'forbidden_data' } {
  if (scanForForbiddenData(value)) return { ok: false, code: 'forbidden_data' };
  const parsed = observabilityEventBatchSchema.safeParse(value);
  return parsed.success
    ? { ok: true, events: parsed.data.events }
    : { ok: false, code: 'batch_invalid' };
}

export function isClientAuthoredEvent(event: ObservabilityEventInput): boolean {
  return event.purpose === 'product_analytics'
    && event.producer === 'product_tool';
}
