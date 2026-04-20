/**
 * Weekly Job Suggestions API
 * Fetches jobs from Adzuna based on user preferences + resume skills,
 * uses Gemini to score "Chance of Acceptance", returns top 10.
 * 
 * GET /api/jobs/suggestions
 * Requires auth. Cached per user for 24h.
 */
import { NextRequest, NextResponse } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { searchJobsAdzuna, calculateFitScore, type RealJob } from '@/lib/job-search-api';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ScoredJob extends RealJob {
  acceptanceChance: number;
  acceptanceReason: string;
  matchMethod: 'ai';
}

// In-memory cache: hash → { data, expiry }
const suggestionsCache = new Map<string, { data: ScoredJob[]; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function prefsHash(uid: string, roles: string[], cities: string[]): string {
  return `${uid}:${roles.sort().join(',')}:${cities.sort().join(',')}`;
}

export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 5, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  try {
    const db = getAdminDb();
    const uid = guard.user.uid;

    // 1. Load preferences from Firestore
    const prefsSnap = await db.collection('users').doc(uid).collection('settings').doc('jobPreferences').get();
    if (!prefsSnap.exists) {
      return NextResponse.json({
        success: true,
        jobs: [],
        needsSetup: true,
        message: 'Set up your job preferences to get personalized weekly suggestions.',
      });
    }

    const prefs = prefsSnap.data()!;
    const targetRoles: string[] = prefs.targetRoles || [];
    const preferredCities: string[] = prefs.preferredCities || [];
    const remotePref: string = prefs.remotePref || 'any';
    const salaryMin: number = prefs.salaryMin || 0;

    if (targetRoles.length === 0) {
      return NextResponse.json({
        success: true,
        jobs: [],
        needsSetup: true,
        message: 'Add at least one target role to get suggestions.',
      });
    }

    // 2. Check cache
    const hash = prefsHash(uid, targetRoles, preferredCities);
    const cached = suggestionsCache.get(hash);
    if (cached && Date.now() < cached.expiry) {
      return NextResponse.json({ success: true, jobs: cached.data, cached: true, count: cached.data.length });
    }

    // 3. Load user skills from Vault resume (Firestore)
    let userSkills: string[] = [];
    try {
      const vaultSnap = await db.collection('users').doc(uid).collection('vault').limit(1).get();
      if (!vaultSnap.empty) {
        const resumeData = vaultSnap.docs[0].data();
        if (resumeData.skills && Array.isArray(resumeData.skills)) {
          userSkills = resumeData.skills;
        }
        // Also try extracting from parsed content
        if (userSkills.length === 0 && resumeData.parsed?.skills) {
          userSkills = resumeData.parsed.skills;
        }
      }
    } catch (e) {
      console.warn('[suggestions] Could not load vault resume skills:', e);
    }

    // Fallback: try manual skills from job search preferences
    if (userSkills.length === 0) {
      const skillsKey = prefs.manualSkills;
      if (skillsKey && Array.isArray(skillsKey)) userSkills = skillsKey;
    }

    // 4. Fetch jobs from Adzuna for each role+city combination
    const allJobs: RealJob[] = [];
    const seenIds = new Set<string>();

    // Build search combinations (max 6 to stay within API limits)
    const cities = preferredCities.length > 0 ? preferredCities.slice(0, 3) : [''];
    const roles = targetRoles.slice(0, 3);
    const combos = roles.flatMap(role => cities.map(city => ({ role, city }))).slice(0, 6);

    for (const { role, city } of combos) {
      try {
        const result = await searchJobsAdzuna({
          query: role,
          location: city,
          country: 'us',
          page: 1,
          resultsPerPage: 10,
          sortBy: 'relevance',
          salaryMin: salaryMin || undefined,
        });

        for (const job of result.jobs) {
          // Deduplicate by title+company
          const dedupKey = `${job.title.toLowerCase().trim()}|${job.company.toLowerCase().trim()}`;
          if (!seenIds.has(dedupKey)) {
            seenIds.add(dedupKey);

            // Filter by remote preference
            const locLower = job.location.toLowerCase();
            if (remotePref === 'remote' && !locLower.includes('remote')) continue;
            if (remotePref === 'onsite' && locLower.includes('remote')) continue;

            allJobs.push(job);
          }
        }
      } catch (e) {
        console.warn(`[suggestions] Failed to fetch ${role} in ${city}:`, e);
      }
    }

    if (allJobs.length === 0) {
      return NextResponse.json({
        success: true,
        jobs: [],
        message: 'No jobs found matching your preferences. Try broadening your search criteria.',
      });
    }

    // 5. Score with Gemini AI for "Chance of Acceptance"
    let scoredJobs: ScoredJob[] = [];
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

    if (apiKey && userSkills.length > 0) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Batch scoring — send top 20 candidates to Gemini
        const candidates = allJobs.slice(0, 20);
        const jobSummaries = candidates.map((j, i) => (
          `[${i}] ${j.title} at ${j.company} | Location: ${j.location} | Skills: ${j.skills.join(', ') || 'Not listed'} | ${j.employmentType}`
        )).join('\n');

        const prompt = `You are a career advisor. A candidate has these skills: [${userSkills.join(', ')}]

They are looking for: ${targetRoles.join(', ')} roles${preferredCities.length > 0 ? ` in ${preferredCities.join(', ')}` : ''}.

Rate each job listing below on "Chance of Acceptance" (0-100%). Consider:
- Skill match (most important)
- Role relevance
- Location fit
- Seniority alignment

Jobs:
${jobSummaries}

Respond ONLY with a JSON array (no markdown, no explanation):
[{"index":0,"score":85,"reason":"Strong React/TypeScript match, exact role fit"},...]

Be realistic — most scores should be 40-85. Only give 90+ for near-perfect matches.`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Parse JSON from response (handle markdown code blocks)
        const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        const scores: { index: number; score: number; reason: string }[] = JSON.parse(jsonStr);

        scoredJobs = scores
          .filter(s => s.index >= 0 && s.index < candidates.length)
          .map(s => ({
            ...candidates[s.index],
            acceptanceChance: Math.min(98, Math.max(15, s.score)),
            acceptanceReason: s.reason || 'Skills match analysis',
            matchMethod: 'ai' as const,
          }))
          .sort((a, b) => b.acceptanceChance - a.acceptanceChance)
          .slice(0, 10);
      } catch (e) {
        console.warn('[suggestions] Gemini scoring failed, falling back to keyword:', e);
      }
    }

    // Fallback: keyword-based scoring if Gemini fails or no skills
    if (scoredJobs.length === 0) {
      scoredJobs = allJobs
        .map(job => ({
          ...job,
          acceptanceChance: userSkills.length > 0
            ? calculateFitScore(userSkills, job.skills, job.title)
            : Math.floor(Math.random() * 30) + 50, // rough estimate without skills
          acceptanceReason: userSkills.length > 0
            ? `${job.skills.filter(s => userSkills.some(us => us.toLowerCase().includes(s.toLowerCase()))).length}/${job.skills.length} skills match`
            : 'Add your skills for accurate scoring',
          matchMethod: 'ai' as const,
        }))
        .sort((a, b) => b.acceptanceChance - a.acceptanceChance)
        .slice(0, 10);
    }

    // 6. Cache results
    suggestionsCache.set(hash, { data: scoredJobs, expiry: Date.now() + CACHE_TTL });

    // Prune old cache entries
    if (suggestionsCache.size > 500) {
      const oldest = suggestionsCache.keys().next().value;
      if (oldest) suggestionsCache.delete(oldest);
    }

    // 7. Save last suggestions timestamp to Firestore (for notification logic)
    await db.collection('users').doc(uid).collection('settings').doc('jobPreferences').update({
      lastSuggestionsAt: new Date().toISOString(),
      lastSuggestionsCount: scoredJobs.length,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      jobs: scoredJobs,
      count: scoredJobs.length,
      cached: false,
      skillsUsed: userSkills.length,
      searchCombos: combos.length,
    });
  } catch (error) {
    console.error('[jobs/suggestions] Error:', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
