import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { invalidateTwin } from '@/lib/career-twin';

/**
 * GET /api/agent/stories
 * Fetch user's STAR stories from Firestore
 */
export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const storiesRef = db.collection('users').doc(uid).collection('agent_stories');
    const snap = await storiesRef.orderBy('createdAt', 'desc').limit(50).get();

    const stories = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return new Response(JSON.stringify({
      stories,
      count: stories.length,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Stories API error:', e);
    return new Response(JSON.stringify({ error: e.message, stories: [], count: 0 }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/agent/stories
 * Create a new STAR story manually
 */
export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const body = await req.json();
    const { title, situation, task, action, result, reflection, tags } = body;

    if (!title?.trim() || !situation?.trim()) {
      return new Response(JSON.stringify({ error: 'title and situation are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const docRef = await db.collection('users').doc(uid).collection('agent_stories').add({
      title: title.trim(),
      situation: situation.trim(),
      task: (task || '').trim(),
      action: (action || '').trim(),
      result: (result || '').trim(),
      reflection: (reflection || '').trim(),
      tags: (tags || []).map((t: string) => t.trim()).filter(Boolean),
      source: 'manual',
      createdAt: new Date().toISOString(),
    });

    invalidateTwin(uid).catch(() => {});

    return new Response(JSON.stringify({ id: docRef.id, success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Stories POST error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * DELETE /api/agent/stories
 * Delete a story by ID
 */
export async function DELETE(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const { storyId } = await req.json();
    if (!storyId) {
      return new Response(JSON.stringify({ error: 'storyId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.collection('users').doc(uid).collection('agent_stories').doc(storyId).delete();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Stories delete error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
