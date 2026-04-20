/**
 * Sona AI Chat API — /api/agent/chat
 * 
 * Streaming chat endpoint powered by OpenRouter.
 * Uses function-calling tools to lazily fetch user context.
 * 
 * Gating:
 *   Free: 2 lifetime interactions
 *   Pro ($9.99): 1 interaction per week
 *   Max ($19.99): Unlimited
 */

import { NextRequest } from 'next/server';
import { guardApiRoute } from '@/lib/api-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { SONA_TOOLS, executeTool } from '@/lib/sona-tools';
import { quickClean } from '@/lib/humanize-guard';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'qwen/qwen3.6-plus'; // Qwen 3.6 Plus — 1M ctx, $0.325/$1.95 per M tokens

// ── Personality Prompts ──
const PERSONALITIES: Record<string, string> = {
  professional: `You are Sona, a career intelligence agent at TalentConsulting.io. You are precise, data-driven, and formal. You analyze data before making recommendations. Use concise, professional language. Address the user respectfully.`,
  coach: `You are Sona, a career coach and AI agent at TalentConsulting.io. You're warm, encouraging, and action-oriented. You motivate while being honest. Use a friendly, conversational tone. Say things like "Let's do this!" and "Great question!"`,
  direct: `You are Sona, a career agent at TalentConsulting.io. You are blunt, no-fluff, results-only. Give the shortest possible answers with maximum actionable content. Skip pleasantries. Use bullet points.`,
};

const BASE_SYSTEM = `
You have access to tools that can fetch the user's resume, job applications, preferences, search for jobs, analyze job fit, morph resumes, draft cover letters, generate tailored resume PDFs, save interview stories, and queue prepared applications. Use these tools when you need real data — don't guess or make up information about the user.

## Core Rules
1. NEVER fabricate information about the user's resume, skills, or applications. Always use tools to check.
2. When drafting emails, cover letters, or resume morphs, present them as drafts for user approval. Say "Here's a draft — review and edit before using."
3. You CANNOT auto-apply to jobs. You search, analyze, draft, and recommend — the user takes the final action.
4. Keep responses focused and actionable. The user is here to advance their career, not chat.
5. If the user hasn't set up preferences or uploaded a resume, guide them to do so.

## Enhanced Fit Gate Protocol (MANDATORY)
Before recommending the user apply to ANY job:
1. Call analyze_job_fit with the job title, description, and company.
2. Present results with ALL intelligence layers:

### Fit Score + Verdict
- If verdict is "strong_match" (80%+): Enthusiastically recommend and offer to prep the application.
- If verdict is "moderate_match" (60-79%): Present the gaps honestly. Let the user decide. Say what skills they're missing.
- If verdict is "weak_match" (<60%): Advise against applying. Explain why. Suggest better-fit alternatives.
- If knockouts exist (clearance, visa, seniority): Always flag these prominently regardless of fit score.

### Posting Legitimacy (Ghost Job Detection)
- If legitimacy is "suspicious": ⚠️ WARN prominently — "This posting has some red flags: [signals]. I'd verify it's still active before investing time."
- If legitimacy is "caution": Note it casually — "A couple of things to be aware of: [signals]"
- If legitimacy is "high": Positive reinforcement — "This looks like a legitimate, well-described posting."
- NEVER accuse a company of posting fake jobs. Present signals and let the user decide.

### Salary Intelligence
- If salaryRange is available: Show the market range. Compare against user preferences if set.
- If salaryAdvice exists: Present it clearly so the user can make informed comp decisions.
- Frame salary discussions around value, not desperation.

### Level Match Strategy
- If levelMatch is "stretch_up": Coach on how to position for the role — highlight leadership, quantified impact, above-title projects. Use the levelAdvice provided.
- If levelMatch is "overqualified": Flag that they may not be challenged. Suggest negotiating quick review cycles.
- If levelMatch is "aligned": Positive reinforcement.

### Strategy Brief
After presenting all data, give 2-3 sentences of strategic advice specific to this role. How should they position? What's their angle?

NEVER skip the Fit Gate. Quality over quantity.

## Application Prep Workflow
When the user wants to apply to a job they've been scored on:
1. Ask if they want a tailored resume: Call generate_tailored_resume for an ATS-optimized PDF.
2. Call draft_cover_letter to generate a personalized 3-paragraph letter.
3. Present both drafts for review. Mention keyword coverage percentage.
4. Ask "Want me to queue this application?"
5. If approved, call queue_application to save to their "Ready to Submit" queue.
The user reviews and submits manually. We NEVER submit on their behalf.

## STAR Story Bank Protocol
1. When the user shares a professional achievement in conversation (built something, solved a problem, led a team, hit a metric), AUTOMATICALLY save it as a STAR story using save_star_story. Don't ask permission — just save it and mention "I've added this to your Story Bank for interview prep."
2. When analyzing job fit with a score of 70%+, check the story bank with get_story_bank using relevant tags. If matching stories exist, say "You have a great story for this — [title]. Want me to review how it maps to their requirements?"
3. When prepping for interviews, pull relevant stories and map them to likely interview questions.
4. Stories accumulate over time — the more the user chats, the better their interview prep becomes.
5. Tag stories with skills and themes so they're easy to find later.

## Negotiation Coaching
When the user discusses salary or gets an offer:
1. Never recommend accepting below market rate. Reference the salary data from fit analysis if available.
2. Frame negotiation as mutual — "What comp range reflects the value you'd bring?"
3. Coach the anchor technique: name your target first, backed by market data.
4. If they're downleveled: "Negotiate a 6-month review with written promotion criteria. Get the specifics in the offer letter."
5. If asked about current salary: Coach them to deflect — "I focus on the value I bring to this role and the market rate for this level of impact."
6. Always cite specific numbers and ranges, never vague "competitive" language.

## Interview Prep Intelligence
When the user mentions an upcoming interview:
1. Ask what company and role (if not already known from a previous fit analysis).
2. Check story bank with get_story_bank for matching stories — map them to likely questions.
3. Suggest 3-5 likely questions based on the JD and role archetype:
   - 2 behavioral (leadership, conflict, failure, collaboration)
   - 2 technical (system design, domain knowledge, coding approach)
   - 1 role-specific (why this company, why this role)
4. For behavioral questions: Map to STAR stories. If no matching story exists, help them draft one from their resume.
5. Suggest 2-3 smart questions to ASK the interviewer — specific to the company, not generic.
6. Red flag prep: Help frame answers for "Why are you leaving?", "Tell me about a failure", "Where do you see yourself in 5 years?" — honest, forward-looking, never defensive.

## HUMANIZED WRITING (CRITICAL — APPLY TO ALL GENERATED CONTENT)
Everything you write for the user — resumes, cover letters, follow-up emails, LinkedIn messages — MUST read as naturally human-written. AI-generated career documents get flagged by recruiters and AI detectors. Follow these rules strictly:

### Banned Vocabulary (NEVER use these words)
delve, tapestry, testament, intricacies, multifaceted, ever-evolving, ever-changing, game-changer, paradigm, synergy, holistic, nuanced, embark, leverage, utilize, pivotal, crucial, landscape, navigate, foster, spearheaded, comprehensive, groundbreaking, innovative, transformative, unprecedented, underscored, vital, robust, seamless, streamline, cutting-edge, realm, beacon, cornerstone, endeavor, facilitate, optimize, enhance, bolster, augment, catalyze, cultivate, empower, harness, propel, elevate, paramount, indispensable, meticulous, adept, proficient, myriad, plethora

### Banned Phrases (NEVER use these patterns)
"it is worth noting", "it's important to note", "in today's rapidly", "plays a crucial role", "serves as a testament", "at the intersection of", "results-driven professional", "proven track record", "passionate about", "committed to excellence", "I am writing to express my interest"

### Writing Style Requirements
1. **Sentence Variance**: Mix short punchy sentences (5-8 words) with longer descriptive ones (20+ words). NEVER write 3 consecutive sentences of similar length.
2. **Contractions**: Use contractions naturally — "I've", "didn't", "we're", "it's". At least 40% of applicable cases.
3. **Specific > Generic**: Instead of "improved performance", write "cut page load from 4.2s to 1.1s". Numbers and specifics are human signals.
4. **Action Verbs**: Use direct, concrete verbs — "built", "shipped", "cut", "grew", "ran", "led" — not inflated ones like "spearheaded" or "orchestrated".
5. **Natural Openers**: Vary how sentences start. Don't begin consecutive bullets with the same word pattern.
6. **Human Tone**: Include natural confidence markers — "I'm proud of", "this was tough but", "the real win was". Avoid robotic uniformity.

### Resume-Specific Rules
- Preserve ALL numbers, percentages, dollar amounts, and team sizes
- Keep ATS-friendly keywords — just use plain language around them
- Start bullets with varied action verbs (built, shipped, cut, grew, ran, designed, reduced, launched)
- Each bullet tells a micro-story: what you did → how → measurable result

### Cover Letter Rules
- Open with WHY this company — never "I am writing to express my interest"
- Middle paragraph: 2-3 achievements matched to their needs, with numbers
- Close with confidence, not desperation. Never "I hope to hear from you"
- Total length: 250-350 words. Short paragraphs. No walls of text.

## Anti-Hallucination Rules
- If information is not in the user's Vault resume, say "I don't have this data — please add it to your resume."
- Do NOT invent achievements, metrics, or employer names.
- If asked to write something you lack context for, say specifically what's missing.
- When morphing resumes, only REFRAME existing bullets — never ADD fictional experiences.

You are part of the TalentConsulting.io platform which includes: Resume Studio (morphing), Interview Simulator (The Gauntlet), Skill Bridge, Market Oracle, Job Search, Application Tracker, AI Writing Tools, and the STAR Story Bank.
`;

// ── Sona Usage Gating ──
async function checkSonaAccess(uid: string, tier: string): Promise<{ allowed: boolean; reason?: string; used?: number; cap?: number }> {
  const db = getAdminDb();

  // Max / God: unlimited
  if (tier === 'studio' || tier === 'god') {
    return { allowed: true };
  }

  const usageRef = db.collection('users').doc(uid).collection('usage').doc('sona');
  const snap = await usageRef.get();
  const data = snap.exists ? snap.data()! : { lifetimeCount: 0, weeklyCount: 0, weekStart: '' };

  const currentWeek = getWeekKey();

  if (tier === 'pro') {
    // Pro: 1 per week
    const weeklyCount = data.weekStart === currentWeek ? (data.weeklyCount || 0) : 0;
    if (weeklyCount >= 1) {
      return { allowed: false, reason: 'You\'ve used your weekly Sona check-in. Upgrade to Max for unlimited access.', used: weeklyCount, cap: 1 };
    }
    return { allowed: true, used: weeklyCount, cap: 1 };
  }

  // Free: 2 lifetime
  const lifetimeCount = data.lifetimeCount || 0;
  if (lifetimeCount >= 2) {
    return { allowed: false, reason: 'You\'ve used both Sona demo sessions. Upgrade to Pro ($9.99/mo) for weekly check-ins or Max ($19.99/mo) for unlimited.', used: lifetimeCount, cap: 2 };
  }
  return { allowed: true, used: lifetimeCount, cap: 2 };
}

async function incrementSonaUsage(uid: string, tier: string): Promise<void> {
  const db = getAdminDb();
  const usageRef = db.collection('users').doc(uid).collection('usage').doc('sona');
  const currentWeek = getWeekKey();

  if (tier === 'studio' || tier === 'god') return; // No tracking for unlimited

  const snap = await usageRef.get();
  const data = snap.exists ? snap.data()! : {};

  if (tier === 'pro') {
    await usageRef.set({
      ...data,
      weeklyCount: data.weekStart === currentWeek ? ((data.weeklyCount || 0) + 1) : 1,
      weekStart: currentWeek,
      lastUsed: new Date().toISOString(),
    }, { merge: true });
  } else {
    await usageRef.set({
      ...data,
      lifetimeCount: (data.lifetimeCount || 0) + 1,
      lastUsed: new Date().toISOString(),
    }, { merge: true });
  }
}

function getWeekKey(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - start.getDay()); // Sunday
  return `${start.getFullYear()}-W${String(Math.ceil((start.getDate()) / 7)).padStart(2, '0')}-${String(start.getMonth() + 1).padStart(2, '0')}`;
}

// ── Conversation Persistence ──

async function loadConversationHistory(uid: string, conversationId: string): Promise<Array<{ role: string; content: string }>> {
  const db = getAdminDb();
  const messagesSnap = await db
    .collection('users').doc(uid)
    .collection('agent').doc('conversations')
    .collection(conversationId)
    .orderBy('timestamp', 'asc')
    .limit(20)
    .get();

  if (messagesSnap.empty) return [];
  return messagesSnap.docs.map(d => ({ role: d.data().role, content: d.data().content }));
}

async function saveMessage(uid: string, conversationId: string, role: string, content: string): Promise<void> {
  const db = getAdminDb();
  await db
    .collection('users').doc(uid)
    .collection('agent').doc('conversations')
    .collection(conversationId)
    .add({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
}

async function upsertConversationMeta(uid: string, conversationId: string, firstMessage?: string, personality?: string): Promise<void> {
  const db = getAdminDb();
  const metaRef = db
    .collection('users').doc(uid)
    .collection('agent').doc('conversationsMeta')
    .collection('list').doc(conversationId);

  const existing = await metaRef.get();
  if (existing.exists) {
    await metaRef.update({ lastMessageAt: new Date().toISOString() });
  } else {
    // Auto-generate title from first message
    const title = firstMessage
      ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '…' : '')
      : 'New conversation';

    await metaRef.set({
      title,
      personality: personality || 'coach',
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    });
  }
}

// ── Main Handler ──
export async function POST(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 10, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'Sona is not configured. Missing OPENROUTER_API_KEY.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  const uid = guard.user.uid;
  const tier = guard.user.tier;

  // Check access
  const access = await checkSonaAccess(uid, tier);
  if (!access.allowed) {
    return new Response(JSON.stringify({ error: access.reason, gated: true, used: access.used, cap: access.cap }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await req.json();
  const { messages, personality = 'coach', conversationId: incomingConvId } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'Messages required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // Resolve conversation ID
  const conversationId = incomingConvId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const isNew = !incomingConvId;

  // Load personality
  const personalitySystem = PERSONALITIES[personality] || PERSONALITIES.coach;
  const systemPrompt = `${personalitySystem}\n${BASE_SYSTEM}`;

  // Build context: load persisted history if resuming, otherwise use client messages
  let contextMessages: Array<{ role: string; content: string }>;
  if (!isNew) {
    const history = await loadConversationHistory(uid, conversationId);
    // Append the latest user message from the client
    const latestUserMsg = messages[messages.length - 1];
    contextMessages = [...history, latestUserMsg];
  } else {
    contextMessages = messages;
  }

  const openRouterMessages = [
    { role: 'system', content: systemPrompt },
    ...contextMessages.slice(-20), // Cap at 20 for context window
  ];

  try {
    // First call: may trigger tool use
    let response = await callOpenRouter(openRouterMessages);
    let responseData = await response.json();

    // Handle tool calls (iterative — max 4 rounds)
    let rounds = 0;
    while (responseData.choices?.[0]?.message?.tool_calls && rounds < 4) {
      const toolCalls = responseData.choices[0].message.tool_calls;
      openRouterMessages.push(responseData.choices[0].message);

      for (const tc of toolCalls) {
        const args = typeof tc.function.arguments === 'string' 
          ? JSON.parse(tc.function.arguments) 
          : tc.function.arguments;
        
        const result = await executeTool(tc.function.name, args, uid);
        openRouterMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        } as any);
      }

      response = await callOpenRouter(openRouterMessages);
      responseData = await response.json();
      rounds++;
    }

    const rawMessage = responseData.choices?.[0]?.message?.content || 'I couldn\'t generate a response. Please try again.';
    const assistantMessage = quickClean(rawMessage);

    // Persist messages to Firestore
    const userMessage = messages[messages.length - 1]?.content || '';
    await Promise.all([
      saveMessage(uid, conversationId, 'user', userMessage),
      saveMessage(uid, conversationId, 'assistant', assistantMessage),
      upsertConversationMeta(uid, conversationId, isNew ? userMessage : undefined, personality),
      incrementSonaUsage(uid, tier),
    ]);

    return new Response(JSON.stringify({
      message: assistantMessage,
      role: 'assistant',
      conversationId,
      usage: responseData.usage,
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[sona/chat] Error:', err);
    return new Response(JSON.stringify({ error: 'Sona encountered an error. Please try again.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

// ── List Conversations ──
export async function GET(req: NextRequest) {
  const guard = await guardApiRoute(req, { rateLimit: 20, rateLimitWindow: 60_000 });
  if (guard.error) return guard.error;

  const db = getAdminDb();
  const uid = guard.user.uid;

  try {
    const snap = await db
      .collection('users').doc(uid)
      .collection('agent').doc('conversationsMeta')
      .collection('list')
      .orderBy('lastMessageAt', 'desc')
      .limit(20)
      .get();

    const conversations = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    }));

    return new Response(JSON.stringify({ conversations }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('[sona/chat] GET Error:', err);
    return new Response(JSON.stringify({ conversations: [] }), { headers: { 'Content-Type': 'application/json' } });
  }
}

async function callOpenRouter(messages: any[]) {
  return fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://talentconsulting.io',
      'X-Title': 'TalentConsulting Sona AI',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: SONA_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });
}

