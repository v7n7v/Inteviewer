/**
 * Story Search — RAG Answer Engine for Behavioral Questions
 * 
 * Classifies behavioral questions → searches Story Bank → drafts answers
 * using the user's own STAR stories as source material.
 */

import { getAdminDb } from '@/lib/firebase-admin';
import { quickClean } from '@/lib/humanize-guard';

// ── Behavioral Question Categories ──

const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  leadership: [
    /lead|led|leadership|manage|mentor|delegate|team.*lead|supervise|direct/i,
    /took charge|stepped up|guided.*team/i,
  ],
  teamwork: [
    /team|collaborat|group|together|cross-functional|partner|peer/i,
    /worked with|coordinated with/i,
  ],
  'conflict resolution': [
    /conflict|disagree|difficult.*person|tension|clash|dispute|argument/i,
    /dealt with|handle.*disagreement|resolve/i,
  ],
  failure: [
    /fail|mistake|wrong|went badly|didn't work|setback|screw.*up/i,
    /learned from|biggest mistake|something.*wrong/i,
  ],
  initiative: [
    /initiative|self-start|proactive|above.*beyond|without.*asked|volunteer/i,
    /identified.*opportunity|saw.*gap|proposed/i,
  ],
  communication: [
    /communicat|present|explain|convey|persuad|influenc|pitch/i,
    /difficult.*conversation|convince|articulate/i,
  ],
  'problem solving': [
    /problem.*solv|challenge|obstacle|complex.*issue|troubleshoot|debug/i,
    /figure.*out|creative.*solution|overcome/i,
  ],
  'time management': [
    /time.*manage|deadline|priorit|multiple.*task|workload|under.*pressure/i,
    /tight.*timeline|fast.*paced|juggl/i,
  ],
  adaptability: [
    /adapt|change|pivot|ambiguity|uncertain|new.*situation|flexibility/i,
    /adjust|shift|evolv|unexpected/i,
  ],
  creativity: [
    /creative|innovate|new.*approach|outside.*box|novel|unique.*idea/i,
    /reimagine|redesign|invent/i,
  ],
  'work ethic': [
    /work.*ethic|dedication|commitment|go.*extra|above.*beyond/i,
    /long.*hours|perseveran|determination|grind/i,
  ],
  'customer focus': [
    /customer|client|user|stakeholder.*satisf|feedback|serve/i,
    /customer.*experience|user.*need|client.*relation/i,
  ],
};

export interface QuestionMatch {
  category: string;
  confidence: number;
  story: {
    id: string;
    title: string;
    situation: string;
    task: string;
    action: string;
    result: string;
    tags: string[];
  } | null;
  alternateStories: number;
}

/** Classify a behavioral question into a category */
export function classifyQuestion(question: string): { category: string; confidence: number }[] {
  const results: { category: string; confidence: number }[] = [];
  const lower = question.toLowerCase();

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(lower)) matchCount++;
    }
    if (matchCount > 0) {
      results.push({
        category,
        confidence: Math.min(100, matchCount * 50),
      });
    }
  }

  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);

  // If nothing matched, return general
  if (results.length === 0) {
    results.push({ category: 'general', confidence: 30 });
  }

  return results;
}

/** Search story bank for the best matching story */
export async function findBestStory(
  uid: string,
  categories: string[]
): Promise<{ best: QuestionMatch['story']; alternateCount: number }> {
  const db = getAdminDb();
  const storiesSnap = await db.collection('users').doc(uid)
    .collection('agent_stories')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  const stories = storiesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

  if (stories.length === 0) {
    return { best: null, alternateCount: 0 };
  }

  // Score each story against the categories
  const scored = stories.map(story => {
    const tags = (story.tags || []).map((t: string) => t.toLowerCase());
    let score = 0;

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i].toLowerCase();
      // Direct tag match
      if (tags.some((t: string) => t.includes(cat) || cat.includes(t))) {
        score += 100 - (i * 20); // Weight by category priority
      }
      // Content match
      const fullText = `${story.situation || ''} ${story.task || ''} ${story.action || ''} ${story.result || ''}`.toLowerCase();
      const catPatterns = CATEGORY_PATTERNS[categories[i]] || [];
      for (const pattern of catPatterns) {
        if (pattern.test(fullText)) {
          score += 30 - (i * 5);
        }
      }
    }

    return { story, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const bestRaw = scored[0];
  if (!bestRaw || bestRaw.score === 0) {
    // No match — return most recent story as fallback
    const fallback = stories[0];
    return {
      best: {
        id: fallback.id,
        title: fallback.title || 'Untitled Story',
        situation: fallback.situation || '',
        task: fallback.task || '',
        action: fallback.action || '',
        result: fallback.result || '',
        tags: fallback.tags || [],
      },
      alternateCount: Math.max(0, stories.length - 1),
    };
  }

  return {
    best: {
      id: bestRaw.story.id,
      title: bestRaw.story.title || 'Untitled Story',
      situation: bestRaw.story.situation || '',
      task: bestRaw.story.task || '',
      action: bestRaw.story.action || '',
      result: bestRaw.story.result || '',
      tags: bestRaw.story.tags || [],
    },
    alternateCount: scored.filter(s => s.score > 0).length - 1,
  };
}

/** Draft a behavioral answer from a STAR story */
export function draftAnswer(
  story: QuestionMatch['story'],
  question: string,
  maxWords: number = 200
): string {
  if (!story) {
    return 'No matching story found in your Story Bank. Try adding more STAR stories from your interview debriefs.';
  }

  // Build a natural answer from STAR components
  const parts: string[] = [];

  if (story.situation) {
    parts.push(story.situation.trim());
  }
  if (story.task) {
    parts.push(story.task.trim());
  }
  if (story.action) {
    parts.push(story.action.trim());
  }
  if (story.result) {
    parts.push(story.result.trim());
  }

  let answer = parts.join(' ');

  // Apply humanization cleanup
  answer = quickClean(answer);

  // Trim to approximate word limit
  const words = answer.split(/\s+/);
  if (words.length > maxWords) {
    answer = words.slice(0, maxWords).join(' ') + '...';
  }

  return answer;
}

/** Full pipeline: classify → search → draft */
export async function answerBehavioralQuestion(
  uid: string,
  question: string
): Promise<{
  categories: { category: string; confidence: number }[];
  story: QuestionMatch['story'];
  answer: string;
  alternateStories: number;
  source: string;
}> {
  // Step 1: Classify
  const categories = classifyQuestion(question);

  // Step 2: Search
  const { best, alternateCount } = await findBestStory(
    uid,
    categories.map(c => c.category)
  );

  // Step 3: Draft
  const answer = draftAnswer(best, question);

  return {
    categories,
    story: best,
    answer,
    alternateStories: alternateCount,
    source: best ? `Story Bank: "${best.title}"` : 'No matching story',
  };
}

/** Get coverage map — which categories have stories, which don't */
export async function getCoverageMap(uid: string): Promise<{
  covered: { category: string; storyCount: number }[];
  uncovered: string[];
  totalStories: number;
  coveragePercent: number;
}> {
  const db = getAdminDb();
  const storiesSnap = await db.collection('users').doc(uid)
    .collection('agent_stories').get();

  const stories = storiesSnap.docs.map(d => d.data());
  const totalStories = stories.length;

  const categoryCounts: Record<string, number> = {};

  for (const category of Object.keys(CATEGORY_PATTERNS)) {
    categoryCounts[category] = 0;
  }

  stories.forEach(story => {
    const tags = (story.tags || []).map((t: string) => t.toLowerCase());
    const fullText = `${story.situation || ''} ${story.task || ''} ${story.action || ''} ${story.result || ''}`.toLowerCase();

    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      if (tags.some((t: string) => t.includes(category) || category.includes(t))) {
        categoryCounts[category]++;
        continue;
      }
      for (const pattern of patterns) {
        if (pattern.test(fullText)) {
          categoryCounts[category]++;
          break;
        }
      }
    }
  });

  const covered = Object.entries(categoryCounts)
    .filter(([, count]) => count > 0)
    .map(([category, storyCount]) => ({ category, storyCount }))
    .sort((a, b) => b.storyCount - a.storyCount);

  const uncovered = Object.entries(categoryCounts)
    .filter(([, count]) => count === 0)
    .map(([category]) => category);

  const coveragePercent = Math.round(
    (covered.length / Object.keys(CATEGORY_PATTERNS).length) * 100
  );

  return { covered, uncovered, totalStories, coveragePercent };
}
