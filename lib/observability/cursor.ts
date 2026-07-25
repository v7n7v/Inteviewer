import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { z } from 'zod';

const cursorPositionSchema = z.object({
  keyVersion: z.string().min(1).max(16).regex(/^[A-Za-z0-9_-]+$/),
  occurredAt: z.string().datetime(),
  documentId: z.string().length(64).regex(/^[a-f0-9]+$/),
}).strict();

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  context: z.string().length(32).regex(/^[a-f0-9]+$/),
  expiresAt: z.string().datetime(),
  positions: z.array(cursorPositionSchema).max(3),
}).strict();

export type ObservabilityCursorPosition = z.infer<typeof cursorPositionSchema>;

function cursorSecret(override?: string): string {
  const secret = override ?? process.env.OBSERVABILITY_CURSOR_SECRET;
  if (!secret || secret.length < 32 || Buffer.byteLength(secret, 'utf8') > 256) {
    throw new Error('OBSERVABILITY_CURSOR_CONFIGURATION_INVALID');
  }
  return secret;
}

function contextFingerprint(context: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`talentconsulting:observability:cursor-context:v1:${context}`)
    .digest('hex')
    .slice(0, 32);
}

const CURSOR_AAD = Buffer.from('talentconsulting:observability:cursor:v1', 'utf8');

function cursorEncryptionKey(secret: string): Buffer {
  return createHash('sha256')
    .update(`talentconsulting:observability:cursor-key:v1:${secret}`)
    .digest();
}

export function signObservabilityCursor(
  input: {
    context: string;
    positions: readonly ObservabilityCursorPosition[];
    expiresAt: Date;
  },
  secretOverride?: string,
): string {
  const secret = cursorSecret(secretOverride);
  const payload = cursorPayloadSchema.parse({
    version: 1,
    context: contextFingerprint(input.context, secret),
    expiresAt: input.expiresAt.toISOString(),
    positions: [...input.positions].sort(
      (left, right) => left.keyVersion.localeCompare(right.keyVersion),
    ),
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cursorEncryptionKey(secret), iv);
  cipher.setAAD(CURSOR_AAD);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
}

export function verifyObservabilityCursor(
  value: string,
  context: string,
  now = new Date(),
  secretOverride?: string,
): { ok: true; positions: ObservabilityCursorPosition[] } | { ok: false } {
  if (!value || value.length > 4_096 || !/^[A-Za-z0-9_.-]+$/.test(value)) return { ok: false };
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = value.split('.');
  if (version !== 'v1' || !encodedIv || !encodedCiphertext || !encodedTag || extra) {
    return { ok: false };
  }
  const secret = cursorSecret(secretOverride);
  try {
    const iv = Buffer.from(encodedIv, 'base64url');
    const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
    const tag = Buffer.from(encodedTag, 'base64url');
    if (
      iv.length !== 12
      || tag.length !== 16
      || ciphertext.length < 1
      || ciphertext.length > 3_072
      || iv.toString('base64url') !== encodedIv
      || ciphertext.toString('base64url') !== encodedCiphertext
      || tag.toString('base64url') !== encodedTag
    ) {
      return { ok: false };
    }
    const decipher = createDecipheriv('aes-256-gcm', cursorEncryptionKey(secret), iv);
    decipher.setAAD(CURSOR_AAD);
    decipher.setAuthTag(tag);
    const cleartext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
    const payload = cursorPayloadSchema.parse(
      JSON.parse(cleartext),
    );
    if (
      payload.context !== contextFingerprint(context, secret)
      || Date.parse(payload.expiresAt) <= now.getTime()
    ) {
      return { ok: false };
    }
    return { ok: true, positions: payload.positions };
  } catch {
    return { ok: false };
  }
}

export function opaqueObservabilityReference(namespace: string, value: string): string {
  return createHash('sha256').update(`${namespace}:${value}`).digest('hex').slice(0, 16);
}
