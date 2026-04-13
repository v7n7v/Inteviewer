/**
 * Gemini Semantic Match Engine
 * Uses gemini-embedding-001 for cosine-similarity scoring
 * between user skills/profile and job descriptions.
 * 
 * This replaces keyword-based matching with true semantic understanding.
 */

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

// ── Embedding cache (15-min TTL) ──
const embeddingCache = new Map<string, { vector: number[]; expiry: number }>();
const EMBED_CACHE_TTL = 15 * 60 * 1000;

/**
 * Generate an embedding vector for a text string using Gemini
 */
async function getEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.slice(0, 200); // Use first 200 chars as key
    const cached = embeddingCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.vector;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const res = await fetch(`${EMBEDDING_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('[SemanticMatch] Embedding API error:', res.status, err.slice(0, 200));
        throw new Error(`Embedding API error: ${res.status}`);
    }

    const data = await res.json();
    const vector = data.embedding?.values;
    if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error('Invalid embedding response');
    }

    embeddingCache.set(cacheKey, { vector, expiry: Date.now() + EMBED_CACHE_TTL });
    return vector;
}

/**
 * Cosine similarity between two vectors
 * Returns value between -1 and 1 (higher = more similar)
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

/**
 * Build a user profile text for embedding
 */
function buildUserProfileText(skills: string[], jobTitle?: string): string {
    const parts: string[] = [];
    if (jobTitle) parts.push(`Looking for: ${jobTitle}`);
    if (skills.length > 0) parts.push(`Skills: ${skills.join(', ')}`);
    return parts.join('. ') || 'General job seeker';
}

/**
 * Build a job text for embedding
 */
function buildJobText(title: string, company: string, description: string, skills: string[]): string {
    const parts = [
        `Job Title: ${title}`,
        `Company: ${company}`,
    ];
    if (skills.length > 0) parts.push(`Requirements: ${skills.join(', ')}`);
    // Use first 500 chars of description (embeddings have token limits)
    if (description) parts.push(`Description: ${description.slice(0, 500)}`);
    return parts.join('. ');
}

export interface SemanticMatchResult {
    jobId: string;
    semanticScore: number; // 0-100
    similarity: number;    // Raw cosine similarity
}

/**
 * Calculate semantic match scores for a batch of jobs against user profile.
 * Returns scores mapped by job ID.
 * 
 * Strategy: embed user profile once, then embed each job and compute cosine similarity.
 * Uses caching to avoid re-embedding identical texts.
 */
export async function semanticMatchJobs(
    userSkills: string[],
    jobs: Array<{ id: string; title: string; company: string; description: string; skills: string[] }>,
    targetTitle?: string,
): Promise<Map<string, SemanticMatchResult>> {
    const results = new Map<string, SemanticMatchResult>();

    try {
        // 1. Embed user profile
        const profileText = buildUserProfileText(userSkills, targetTitle);
        const profileVec = await getEmbedding(profileText);

        // 2. Embed and score each job (with concurrency limit)
        const BATCH_SIZE = 5;
        for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
            const batch = jobs.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (job) => {
                try {
                    const jobText = buildJobText(job.title, job.company, job.description, job.skills);
                    const jobVec = await getEmbedding(jobText);
                    const similarity = cosineSimilarity(profileVec, jobVec);

                    // Map cosine similarity (typically 0.3-0.9 for related texts) to 40-98 range
                    const normalized = Math.max(0, Math.min(1, (similarity - 0.3) / 0.6));
                    const score = Math.round(40 + normalized * 58);

                    results.set(job.id, {
                        jobId: job.id,
                        semanticScore: Math.min(98, Math.max(40, score)),
                        similarity,
                    });
                } catch (err) {
                    console.warn(`[SemanticMatch] Failed for job ${job.id}:`, err);
                    // Fallback: don't set a score, let the caller use keyword-based
                }
            });
            await Promise.all(promises);
        }
    } catch (err) {
        console.error('[SemanticMatch] Profile embedding failed:', err);
        // Return empty — caller falls back to keyword scoring
    }

    return results;
}

/**
 * Hybrid scoring: blend keyword score and semantic score
 * weightSemantic: 0.0 (all keyword) to 1.0 (all semantic)
 */
export function hybridScore(
    keywordScore: number,
    semanticScore: number | undefined,
    weightSemantic = 0.6,
): number {
    if (semanticScore === undefined) return keywordScore;
    const blended = keywordScore * (1 - weightSemantic) + semanticScore * weightSemantic;
    return Math.min(98, Math.max(40, Math.round(blended)));
}
