/**
 * Network CRM API
 * Manage professional contacts — recruiters, hiring managers, referrals.
 * CRUD operations + AI-powered follow-up suggestions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 30, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const userId = guard.user.uid;
    const db = getAdminDb();
    const snap = await db
      .collection('users').doc(userId)
      .collection('network_contacts')
      .orderBy('updated_at', 'desc')
      .limit(100)
      .get();

    const contacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, contacts });
  } catch (error: any) {
    console.error('[Network] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    const userId = guard.user.uid;
    const body = await req.json();
    const { action } = body;

    const db = getAdminDb();
    const contactsRef = db.collection('users').doc(userId).collection('network_contacts');

    if (action === 'create') {
      const { name, company, role, email, phone, linkedin, type, notes, applicationId } = body;
      if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

      const doc = await contactsRef.add({
        name,
        company: company || '',
        role: role || '',
        email: email || '',
        phone: phone || '',
        linkedin: linkedin || '',
        type: type || 'other', // recruiter | hiring_manager | referral | peer | other
        notes: notes || '',
        applicationId: applicationId || null,
        lastContactedAt: null,
        followUpDate: null,
        interactions: [],
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, id: doc.id });
    }

    if (action === 'update') {
      const { id, ...updates } = body;
      if (!id) return NextResponse.json({ error: 'Contact ID required' }, { status: 400 });
      await contactsRef.doc(id).update({
        ...updates,
        action: FieldValue.delete(), // remove `action` from updates
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'log_interaction') {
      const { id, interactionType, note } = body;
      if (!id) return NextResponse.json({ error: 'Contact ID required' }, { status: 400 });
      await contactsRef.doc(id).update({
        interactions: FieldValue.arrayUnion({
          type: interactionType || 'note', // email | call | meeting | linkedin | note
          note: note || '',
          date: new Date().toISOString(),
        }),
        lastContactedAt: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { id } = body;
      if (!id) return NextResponse.json({ error: 'Contact ID required' }, { status: 400 });
      await contactsRef.doc(id).delete();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Network] POST Error:', error);
    return NextResponse.json({ error: 'Failed to process request.' }, { status: 500 });
  }
}
