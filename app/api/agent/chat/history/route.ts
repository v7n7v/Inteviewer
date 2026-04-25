import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * GET /api/agent/chat/history?conversationId=xxx
 * Returns the messages for a specific conversation.
 */
export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const conversationId = req.nextUrl.searchParams.get('conversationId');
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
  }

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const messagesSnap = await db
      .collection('users').doc(uid)
      .collection('agent').doc('conversations')
      .collection(conversationId)
      .orderBy('timestamp', 'asc')
      .limit(50)
      .get();

    if (messagesSnap.empty) {
      return NextResponse.json({ messages: [] });
    }

    const messages = messagesSnap.docs
      .map(d => {
        const data = d.data();
        return { role: data.role, content: data.content };
      })
      .filter(m => m.role === 'user' || m.role === 'assistant');

    return NextResponse.json({ messages });
  } catch (err: any) {
    console.error('[api/agent/chat/history] Error:', err);
    return NextResponse.json({ messages: [], error: err.message }, { status: 500 });
  }
}
