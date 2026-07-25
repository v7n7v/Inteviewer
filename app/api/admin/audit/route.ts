import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization',
};
const SAFE_CURSOR = /^[A-Za-z0-9_-]{1,128}$/;

function boundedLimit(value: string | null) {
  const parsed = Number(value || 75);
  return Math.min(Math.max(Number.isFinite(parsed) ? Math.floor(parsed) : 75, 1), 200);
}

function safeMetadataValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const secretLooking = /(?:sk_(?:live|test)|AIza|Bearer\s+|password|credential|client.?secret|private.?key|webhook.?secret)/i;
    return secretLooking.test(value) ? '[redacted]' : value.slice(0, 300);
  }
  if (depth >= 2) return '[bounded]';
  if (Array.isArray(value)) {
    return value.slice(0, 10).map(item => safeMetadataValue(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return null;
  const blocked = /secret|token|password|credential|customer.?id|resume|content|raw|payload/i;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.test(key))
      .slice(0, 20)
      .map(([key, item]) => [key.slice(0, 80), safeMetadataValue(item, depth + 1)]),
  );
}

function safeMetadata(value: unknown) {
  const result = safeMetadataValue(value);
  return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
}

function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function evidenceRef(kind: string, value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  return createHash('sha256')
    .update(`admin-audit:${kind}:${value}`)
    .digest('hex')
    .slice(0, 16);
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin(request, 'admin.audit.read');
  if (guard.error) return guard.error;

  const params = new URL(request.url).searchParams;
  const limit = boundedLimit(params.get('limit'));
  const cursor = params.get('cursor');
  const actionFilter = String(params.get('action') || '').trim().slice(0, 120);
  const roleFilter = String(params.get('role') || '').trim().slice(0, 60);
  const format = params.get('format');
  const includeIdentities = params.get('includeIdentities') === '1'
    && guard.actor.permissions.includes('admin.accounts.read');
  try {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db
      .collection('admin_audit_log');
    if (actionFilter) query = query.where('action', '==', actionFilter);
    if (roleFilter) query = query.where('actorRole', '==', roleFilter);
    query = query
      .orderBy('occurredAt', 'desc')
      .orderBy(FieldPath.documentId(), 'desc');
    if (cursor) {
      if (!SAFE_CURSOR.test(cursor)) {
        return NextResponse.json(
          { error: 'Audit cursor is invalid or no longer matches this filter.', code: 'ADMIN_AUDIT_CURSOR_INVALID' },
          { status: 409, headers: PRIVATE_HEADERS },
        );
      }
      const cursorSnapshot = await db.collection('admin_audit_log').doc(cursor).get();
      const cursorData = cursorSnapshot.data();
      if (
        !cursorSnapshot.exists
        || (actionFilter && cursorData?.action !== actionFilter)
        || (roleFilter && cursorData?.actorRole !== roleFilter)
      ) {
        return NextResponse.json(
          { error: 'Audit cursor is invalid or no longer matches this filter.', code: 'ADMIN_AUDIT_CURSOR_INVALID' },
          { status: 409, headers: PRIVATE_HEADERS },
        );
      }
      query = query.startAfter(cursorSnapshot);
    }
    const snapshot = await query.limit(limit).get();
    const audit = snapshot.docs
      .map(document => {
        const data = document.data();
        return {
          id: document.id,
          action: typeof data.action === 'string' ? data.action : '',
          actorUid: includeIdentities
            ? (typeof data.actorUid === 'string' ? data.actorUid : '')
            : evidenceRef('actor', data.actorUid) || '',
          actorEmail: includeIdentities && typeof data.actorEmail === 'string' ? data.actorEmail : '',
          actorRole: typeof data.actorRole === 'string' ? data.actorRole : 'unknown',
          targetUid: includeIdentities
            ? (typeof data.targetUid === 'string' ? data.targetUid : null)
            : evidenceRef('target', data.targetUid),
          targetEmail: includeIdentities && typeof data.targetEmail === 'string' ? data.targetEmail : null,
          targetCaseId: evidenceRef('case', data.targetCaseId),
          occurredAt: typeof data.occurredAt === 'string' ? data.occurredAt : '',
          metadata: safeMetadata(data.metadata),
        };
      });
    const lastReturnedId = audit.at(-1)?.id || null;
    const nextCursor = audit.length === limit ? lastReturnedId : null;

    if (format === 'csv') {
      const rows = [
        [
          'occurredAt',
          'action',
          'actorRole',
          'targetScope',
          ...(includeIdentities ? ['actorEmail', 'targetEmail'] : []),
        ],
        ...audit.map(entry => [
          entry.occurredAt,
          entry.action,
          entry.actorRole,
          entry.targetCaseId ? 'support_case' : entry.targetUid || entry.targetEmail ? 'account' : 'platform',
          ...(includeIdentities ? [entry.actorEmail, entry.targetEmail || ''] : []),
        ]),
      ];
      return new NextResponse(rows.map(row => row.map(csvCell).join(',')).join('\r\n'), {
        headers: {
          ...PRIVATE_HEADERS,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="talent-admin-audit.csv"',
        },
      });
    }

    return NextResponse.json(
      {
        audit,
        nextCursor,
        meta: {
          requestId: crypto.randomUUID(),
          generatedAt: new Date().toISOString(),
          staleAfterMs: 60_000,
          partial: false,
          truncated: Boolean(nextCursor),
          scanLimit: limit,
          filterMode: actionFilter || roleFilter ? 'indexed_query' : 'direct_page',
          identitiesIncluded: includeIdentities,
        },
      },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    console.error('[admin/audit] read failed', error);
    return NextResponse.json(
      { error: 'The administrative audit trail is temporarily unavailable.', code: 'ADMIN_AUDIT_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
}
