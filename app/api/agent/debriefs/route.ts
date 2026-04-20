import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { invalidateTwin } from '@/lib/career-twin';

export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 30, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const snap = await db.collection('users').doc(uid).collection('debriefs')
      .orderBy('createdAt', 'desc').limit(50).get();

    const debriefs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return new Response(JSON.stringify({ debriefs }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, debriefs: [] }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const body = await req.json();
    const {
      company, role, roundType, date,
      questions, overallFeeling, strengths, weaknesses,
      surprises, wouldChange, interviewerVibe,
      followUpSent, outcome,
    } = body;

    if (!company || !role) {
      return new Response(JSON.stringify({ error: 'Company and role are required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const docRef = await db.collection('users').doc(uid).collection('debriefs').add({
      company, role, roundType: roundType || 'behavioral',
      date: date || new Date().toISOString().split('T')[0],
      questions: (questions || []).filter((q: any) => q.text?.trim()),
      overallFeeling: overallFeeling || 3,
      strengths: strengths || '', weaknesses: weaknesses || '',
      surprises: surprises || '', wouldChange: wouldChange || '',
      interviewerVibe: interviewerVibe || 'neutral',
      followUpSent: followUpSent || false,
      outcome: outcome || 'pending',
      createdAt: new Date().toISOString(),
    });

    // Auto-generate STAR story from debrief questions with high confidence
    const goodQuestions = (questions || []).filter((q: any) => q.text?.trim() && q.confidence >= 60);
    if (goodQuestions.length > 0) {
      try {
        const topQ = goodQuestions[0];
        await db.collection('users').doc(uid).collection('stories').add({
          title: `${role} @ ${company} — ${topQ.category || 'Interview'} Question`,
          situation: `During a ${roundType?.replace('_', ' ') || 'behavioral'} interview at ${company} for the ${role} position.`,
          task: `Was asked: "${topQ.text}"`,
          action: strengths || '(Fill in your answer approach)',
          result: `Self-assessed confidence: ${topQ.confidence}%. ${overallFeeling >= 4 ? 'Strong performance overall.' : 'Room for improvement.'}`,
          reflection: weaknesses ? `Area to improve: ${weaknesses}` : 'Review and refine this story for next time.',
          tags: [company, roundType?.replace('_', ' ') || 'Interview', topQ.category || 'General'].filter(Boolean),
          source: 'interview_debrief',
          createdAt: new Date().toISOString(),
        });
      } catch { /* story save is best-effort */ }
    }

    // Invalidate the Digital Twin so it recomputes on next read
    invalidateTwin(uid).catch(() => {});

    return new Response(JSON.stringify({ id: docRef.id, success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Debrief ID required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const allowed = ['outcome', 'followUpSent', 'strengths', 'weaknesses'];
    const safeUpdates: Record<string, any> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) safeUpdates[key] = updates[key];
    }
    safeUpdates.updatedAt = new Date().toISOString();

    await db.collection('users').doc(uid).collection('debriefs').doc(id).update(safeUpdates);

    invalidateTwin(uid).catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const uid = guard.user.uid;
  const db = getAdminDb();

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'Debrief ID required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    await db.collection('users').doc(uid).collection('debriefs').doc(id).delete();
    invalidateTwin(uid).catch(() => {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
