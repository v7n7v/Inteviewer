/**
 * Salary Negotiation Coach
 * Generates counter-offer strategies, scripts, and BATNA analysis
 * based on the user's offer details and market data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { groqJSONCompletion } from '@/lib/ai/groq-client';
import { getAdminDb } from '@/lib/firebase-admin';
import { monitor } from '@/lib/monitor';

export async function POST(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
    if (guard.error) return guard.error;

    if (guard.user.tier === 'free') {
      return NextResponse.json(
        { error: 'Salary Negotiation Coach is a Pro feature.', upgrade: true },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { company, role, offerBase, offerTotal, desiredBase, desiredTotal, hasCompetingOffer, benefits, context } = body;

    if (!company || !role || !offerBase) {
      return NextResponse.json({ error: 'company, role, and offerBase are required' }, { status: 400 });
    }

    const userId = guard.user.uid;
    const db = getAdminDb();

    // Fetch resume for leverage context
    let resumeContext = '';
    const resumeSnap = await db
      .collection('users').doc(userId)
      .collection('resume_versions')
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    if (!resumeSnap.empty) {
      const resume = resumeSnap.docs[0].data()?.content;
      if (resume) {
        const yearsExp = (resume.experience || []).length;
        resumeContext = `Candidate: ${resume.name || ''}, ${resume.title || ''}, ~${yearsExp} roles. Top skills: ${(resume.skills || []).flatMap((c: any) => c.items || []).slice(0, 8).join(', ')}`;
      }
    }

    const result = await groqJSONCompletion<{
      marketRange: { low: number; mid: number; high: number };
      verdict: 'below_market' | 'at_market' | 'above_market';
      verdictMessage: string;
      counterStrategy: string;
      emailScript: string;
      phoneScript: string;
      batna: string;
      leveragePoints: string[];
      nonSalaryAsks: string[];
      redFlags: string[];
    }>(
      `You are an elite salary negotiation coach. You have coached 1000+ candidates to get 10-30% higher offers. Your tone is confident, practical, and data-driven.

RULES:
1. Always recommend negotiating — even above-market offers have room
2. Provide specific dollar amounts and percentage targets
3. Email script should be 5-7 sentences, professional but assertive
4. Phone script should be conversational talking points, not a word-for-word script
5. BATNA = Best Alternative To Negotiated Agreement
6. Focus on total comp (base + bonus + equity + benefits), not just base
7. Never sound desperate or apologetic
8. BANNED phrases: "I really appreciate the offer", "I don't want to seem greedy", "I know these are tough times"
9. Leverage points should reference specific experience/skills from the resume
10. Non-salary asks: signing bonus, extra PTO, remote flexibility, title bump, relocation, equity refresh

Return JSON:
{
  "marketRange": { "low": 120000, "mid": 140000, "high": 165000 },
  "verdict": "below_market",
  "verdictMessage": "This offer is ~15% below market median for this role and experience level.",
  "counterStrategy": "paragraph explaining the overall approach",
  "emailScript": "the actual email to send",
  "phoneScript": "talking points for a call",
  "batna": "what to do if they don't budge",
  "leveragePoints": ["specific leverage point 1", "point 2"],
  "nonSalaryAsks": ["signing bonus", "extra PTO week"],
  "redFlags": ["any red flags in this offer or company"]
}`,
      `OFFER DETAILS:\nCompany: ${company}\nRole: ${role}\nBase Offer: $${offerBase}k\n${offerTotal ? `Total Comp Offer: $${offerTotal}k` : ''}\n${desiredBase ? `Desired Base: $${desiredBase}k` : ''}\n${desiredTotal ? `Desired Total: $${desiredTotal}k` : ''}\nCompeting Offer: ${hasCompetingOffer ? 'Yes' : 'No'}\nBenefits: ${benefits || 'Not specified'}\nContext: ${context || 'Standard negotiation'}\n\nCANDIDATE:\n${resumeContext}`,
      { temperature: 0.5, maxTokens: 3000 }
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('[Negotiate] Error:', error);
    monitor.critical('Tool: agent/negotiate', String(error));
    return NextResponse.json(
      { error: 'Failed to generate negotiation strategy.' },
      { status: 500 }
    );
  }
}
