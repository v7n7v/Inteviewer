/**
 * Admin Costs API — Financial estimates & usage breakdown
 * GET /api/admin/costs
 * 
 * Aggregates global usage (voice, writing) and applies current pricing models
 * to calculate estimated MRR vs Total Costs.
 * Implements a 1-hour Firestore cache to prevent massive read costs on 10,000+ users.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { isMasterAccount } from '@/lib/pricing-tiers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const guard = await guardApiRoute(req);
    if (guard.error) return guard.error;
    if (!isMasterAccount(guard.user.email)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const auth = getAdminAuth();
    const db = getAdminDb();

    // 1. Check Cache
    const cacheRef = db.collection('admin').doc('cache_costs_v2');
    try {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const data = cacheDoc.data()!;
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        if (data.lastUpdated && data.lastUpdated > oneHourAgo) {
          return NextResponse.json(data.payload);
        }
      }
    } catch { /* Ignore cache read errors */ }

    // 2. Fetch Users (for MRR and Active counts)
    const allUsers: any[] = [];
    let pageToken: string | undefined;
    do {
      const result = await auth.listUsers(1000, pageToken);
      result.users.forEach(u => allUsers.push(u));
      pageToken = result.pageToken;
    } while (pageToken);

    // Active users (last 30 days) for infra estimates
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = allUsers.filter(u => u.metadata.lastSignInTime && new Date(u.metadata.lastSignInTime) >= thirtyDaysAgo).length;

    // Calculate exact MRR
    let mrr = 0;
    try {
      // Since fetching all subscriptions is expensive, we approximate MRR from stats API
      // For precision, ideally we'd query all subscriptions. Since we loop all users in stats,
      // we'll fetch stats cache if it exists, or just do a quick count.
      // We will loop through up to 500 users to sample usage, and multiply up.
    } catch {}

    // 3. Sample Usage (To save Firebase Reads, we sample up to 1000 recent users and extrapolate, or if < 1000 users, read all)
    const sampleSize = Math.min(allUsers.length, 1000);
    const sampleUsers = allUsers.slice(0, sampleSize);
    
    let totalVoiceSeconds = 0;
    let totalWrittenWords = 0;
    let totalFeatureInvocations = 0;
    
    let proCount = 0;
    let studioCount = 0;

    await Promise.all(
      sampleUsers.map(async (u) => {
        try {
          // Tier check for MRR
          const subDoc = await db.collection('users').doc(u.uid).collection('subscription').doc('current').get();
          if (subDoc.exists && subDoc.data()?.status === 'active') {
             if (subDoc.data()?.plan === 'studio') studioCount++;
             else if (subDoc.data()?.plan === 'pro') proCount++;
          }

          // Voice
          const voiceDoc = await db.collection('users').doc(u.uid).collection('usage').doc('voice_monthly').get();
          if (voiceDoc.exists) totalVoiceSeconds += (voiceDoc.data()?.usedSeconds || 0);

          // Writing
          const writingDoc = await db.collection('users').doc(u.uid).collection('usage').doc('writing_monthly').get();
          if (writingDoc.exists) totalWrittenWords += (writingDoc.data()?.usedWords || 0);

          // Lifetime features
          const usageDoc = await db.collection('users').doc(u.uid).collection('usage').doc('lifetime').get();
          if (usageDoc.exists) {
            const data = usageDoc.data()!;
            totalFeatureInvocations += (data.morphs || 0) + (data.gauntlets || 0) + (data.resumeChecks || 0);
          }
        } catch { /* skip */ }
      })
    );

    // Extrapolate if we sampled
    const multiplier = allUsers.length > 0 ? (allUsers.length / sampleSize) : 1;
    totalVoiceSeconds = Math.round(totalVoiceSeconds * multiplier);
    totalWrittenWords = Math.round(totalWrittenWords * multiplier);
    totalFeatureInvocations = Math.round(totalFeatureInvocations * multiplier);
    
    mrr = ((proCount * multiplier) * 9.99) + ((studioCount * multiplier) * 19.99);

    // 4. PRICING FORMULAS
    
    // Gemini Voice: Native Multimodal Audio (25 tokens/sec). Blended I/O rate ~$0.000005 per second
    const geminiVoiceCost = totalVoiceSeconds * 0.000005;
    
    // Gemini Flash: ~$0.0000015 per word
    const geminiTextCost = totalWrittenWords * 0.0000015;
    
    // Groq: Fast inference. ~$0.00005 per invocation
    const groqCost = totalFeatureInvocations * 0.00005;

    // Infrastructure: Google Cloud Run ($5 base + $0.05 per active user compute/bandwidth)
    const cloudRunCost = 5.00 + (activeUsers * 0.05);

    // Firebase: Base $0 + Reads ($0.036/100k). Estimate 2000 reads per active user
    const firebaseCost = ((activeUsers * 2000) / 100000) * 0.036;

    // Upstash: $0.20 per 100k commands. Estimate 500 commands per active user
    const upstashCost = ((activeUsers * 500) / 100000) * 0.20;

    // Aggregates
    const aiCostTotal = geminiVoiceCost + geminiTextCost + groqCost;
    const infraCostTotal = cloudRunCost + firebaseCost + upstashCost;
    const totalCost = aiCostTotal + infraCostTotal;
    
    const profitMargin = mrr > 0 ? ((mrr - totalCost) / mrr) * 100 : 0;
    const costPerUser = activeUsers > 0 ? totalCost / activeUsers : 0;

    const payload = {
      mrr: Number(mrr.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      netProfit: Number((mrr - totalCost).toFixed(2)),
      profitMargin: Number(profitMargin.toFixed(1)),
      costPerUser: Number(costPerUser.toFixed(3)),
      activeUsers,
      breakdown: {
        ai: {
          geminiVoice: Number(geminiVoiceCost.toFixed(3)),
          geminiText: Number(geminiTextCost.toFixed(3)),
          groq: Number(groqCost.toFixed(3)),
          total: Number(aiCostTotal.toFixed(2))
        },
        infra: {
          cloudRun: Number(cloudRunCost.toFixed(2)),
          firebase: Number(firebaseCost.toFixed(3)),
          upstash: Number(upstashCost.toFixed(3)),
          total: Number(infraCostTotal.toFixed(2))
        }
      },
      metrics: {
        voiceSeconds: totalVoiceSeconds,
        writtenWords: totalWrittenWords,
        invocations: totalFeatureInvocations
      }
    };

    // 5. Save to Cache
    try {
      await cacheRef.set({
        lastUpdated: Date.now(),
        payload
      });
    } catch { console.error('Failed to write costs cache'); }

    return NextResponse.json(payload);

  } catch (error) {
    console.error('[api/admin/costs] error:', error);
    return NextResponse.json({ error: 'Failed to compute costs' }, { status: 500 });
  }
}
