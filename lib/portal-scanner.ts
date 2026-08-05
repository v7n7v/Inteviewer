/**
 * Portal Scanner — Direct ATS API Integration
 * Hits Greenhouse, Ashby, and Lever's public job board APIs
 * for fresher, more accurate listings than aggregators.
 *
 * All three expose public JSON endpoints — no API keys needed.
 */

export interface PortalJob {
  id: string;
  title: string;
  company: string;
  location: string;
  department: string;
  url: string;
  postedDate: string;
  source: 'greenhouse' | 'ashby' | 'lever';
  description?: string;
}

export interface PortalSearchResult {
  jobs: PortalJob[];
  totalCount: number;
  source: string;
  company: string;
}

// ── In-memory cache (10-min TTL) ──
const portalCache = new Map<string, { data: PortalSearchResult; expiry: number }>();
const PORTAL_CACHE_TTL = 10 * 60 * 1000;

// ============================================================
// GREENHOUSE — Public board API
// Docs: https://developers.greenhouse.io/job-board.html
// Endpoint: https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
// ============================================================
// `limit` is part of the cache key on purpose: the cache stores the already-sliced
// result, so a 50-capped entry must not satisfy a later request for the full board.
// The default of 50 is right for looking at one company; the index needs everything,
// and Databricks alone posts 807.
export async function searchGreenhouse(companySlug: string, query?: string, limit = 50): Promise<PortalSearchResult> {
  const cacheKey = `gh:${companySlug}:${query || ''}:${limit}`;
  const cached = portalCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return { ...cached.data };

  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs?content=true`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Greenhouse: ${res.status}`);
    const data = await res.json();

    let jobs: PortalJob[] = (data.jobs || []).map((j: any) => ({
      id: `gh-${j.id}`,
      title: j.title || '',
      company: data.name || companySlug,
      location: j.location?.name || 'Not Specified',
      department: j.departments?.[0]?.name || '',
      url: j.absolute_url || `https://boards.greenhouse.io/${companySlug}/jobs/${j.id}`,
      postedDate: j.updated_at || j.created_at || new Date().toISOString(),
      source: 'greenhouse' as const,
      description: stripHtml(j.content || '').slice(0, 500),
    }));

    // Filter by query if provided
    if (query) {
      const q = query.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.department.toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q)
      );
    }

    const result: PortalSearchResult = {
      jobs: jobs.slice(0, limit),
      totalCount: jobs.length,
      source: 'Greenhouse',
      company: data.name || companySlug,
    };

    portalCache.set(cacheKey, { data: result, expiry: Date.now() + PORTAL_CACHE_TTL });
    return result;
  } catch (e: any) {
    console.error(`Greenhouse scan failed for ${companySlug}:`, e.message);
    return { jobs: [], totalCount: 0, source: 'Greenhouse (error)', company: companySlug };
  }
}

// ============================================================
// LEVER — Public postings API
// Endpoint: https://api.lever.co/v0/postings/{company}
// ============================================================
export async function searchLever(companySlug: string, query?: string, limit = 50): Promise<PortalSearchResult> {
  const cacheKey = `lv:${companySlug}:${query || ''}:${limit}`;
  const cached = portalCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return { ...cached.data };

  try {
    const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Lever: ${res.status}`);
    const data = await res.json();

    let jobs: PortalJob[] = (Array.isArray(data) ? data : []).map((j: any) => ({
      id: `lv-${j.id}`,
      title: j.text || '',
      company: companySlug,
      location: j.categories?.location || 'Not Specified',
      department: j.categories?.department || j.categories?.team || '',
      url: j.hostedUrl || j.applyUrl || '#',
      postedDate: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
      source: 'lever' as const,
      description: stripHtml(j.descriptionPlain || j.description || '').slice(0, 500),
    }));

    if (query) {
      const q = query.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.department.toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q)
      );
    }

    const result: PortalSearchResult = {
      jobs: jobs.slice(0, limit),
      totalCount: jobs.length,
      source: 'Lever',
      company: companySlug,
    };

    portalCache.set(cacheKey, { data: result, expiry: Date.now() + PORTAL_CACHE_TTL });
    return result;
  } catch (e: any) {
    console.error(`Lever scan failed for ${companySlug}:`, e.message);
    return { jobs: [], totalCount: 0, source: 'Lever (error)', company: companySlug };
  }
}

// ============================================================
// ASHBY — Public job board API
// Endpoint: https://api.ashbyhq.com/posting-api/job-board/{board_slug}
// ============================================================
export async function searchAshby(companySlug: string, query?: string, limit = 50): Promise<PortalSearchResult> {
  const cacheKey = `ash:${companySlug}:${query || ''}:${limit}`;
  const cached = portalCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return { ...cached.data };

  try {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${companySlug}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Ashby: ${res.status}`);
    const data = await res.json();

    let jobs: PortalJob[] = (data.jobs || []).map((j: any) => ({
      id: `ash-${j.id}`,
      title: j.title || '',
      company: data.organizationName || companySlug,
      location: j.location || j.locationName || 'Not Specified',
      department: j.departmentName || j.department || '',
      url: j.jobUrl || `https://jobs.ashbyhq.com/${companySlug}/${j.id}`,
      postedDate: j.publishedAt || new Date().toISOString(),
      source: 'ashby' as const,
      description: stripHtml(j.descriptionHtml || j.descriptionPlain || '').slice(0, 500),
    }));

    if (query) {
      const q = query.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.department.toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q)
      );
    }

    const result: PortalSearchResult = {
      jobs: jobs.slice(0, limit),
      totalCount: jobs.length,
      source: 'Ashby',
      company: data.organizationName || companySlug,
    };

    portalCache.set(cacheKey, { data: result, expiry: Date.now() + PORTAL_CACHE_TTL });
    return result;
  } catch (e: any) {
    console.error(`Ashby scan failed for ${companySlug}:`, e.message);
    return { jobs: [], totalCount: 0, source: 'Ashby (error)', company: companySlug };
  }
}

// ============================================================
// MULTI-PORTAL SCAN — Try all three for a company
// ============================================================
export async function scanCompanyPortals(
  companySlug: string,
  query?: string
): Promise<PortalSearchResult> {
  // Try all three in parallel — most companies use only one
  const [gh, lv, ash] = await Promise.allSettled([
    searchGreenhouse(companySlug, query),
    searchLever(companySlug, query),
    searchAshby(companySlug, query),
  ]);

  const allJobs: PortalJob[] = [];
  let companyName = companySlug;
  const sources: string[] = [];

  for (const result of [gh, lv, ash]) {
    if (result.status === 'fulfilled' && result.value.jobs.length > 0) {
      allJobs.push(...result.value.jobs);
      companyName = result.value.company;
      sources.push(result.value.source);
    }
  }

  return {
    jobs: allJobs.slice(0, 50),
    totalCount: allJobs.length,
    source: sources.length > 0 ? sources.join(' + ') : 'No portal found',
    company: companyName,
  };
}

// ── Well-known company → ATS slug mapping ──
// These are public board slugs — easily verified
// Every entry below was called live on 2026-08-04 and the posting count recorded.
// Six rows were wrong before that check: netflix and twitch were registered on
// Lever and both 404 (Netflix has left Lever entirely), and ramp, notion, plaid and
// benchling were registered on Greenhouse where all four 404 — they are on Ashby,
// and between them carry 391 postings that were unreachable. 'ramp-ashby' was a
// duplicate key pointing at the same board as 'ramp'.
//
// A wrong platform is silent: the adapter gets a 404, returns empty, and search
// simply finds nothing for that company. Re-verify counts before trusting them; a
// board can empty out or migrate at any time. An Ashby board that returns 200 with
// zero jobs (vercel today) is indistinguishable from a wrong slug — both are valid
// responses, so neither can be auto-detected as an error.
export const KNOWN_BOARDS: Record<string, { platform: 'greenhouse' | 'lever' | 'ashby'; slug: string }> = {
  // Greenhouse — 2,350 postings verified 2026-08-04
  'databricks': { platform: 'greenhouse', slug: 'databricks' }, // 807
  'stripe': { platform: 'greenhouse', slug: 'stripe' },         // 550
  'cloudflare': { platform: 'greenhouse', slug: 'cloudflare' }, // 290
  'airbnb': { platform: 'greenhouse', slug: 'airbnb' },         // 189
  'figma': { platform: 'greenhouse', slug: 'figma' },           // 177
  'coinbase': { platform: 'greenhouse', slug: 'coinbase' },     // 163
  'duolingo': { platform: 'greenhouse', slug: 'duolingo' },     // 65
  'twitch': { platform: 'greenhouse', slug: 'twitch' },         // 62 — was on Lever (404)
  'discord': { platform: 'greenhouse', slug: 'discord' },       // 47

  // Ashby — 416 postings verified 2026-08-04
  'ramp': { platform: 'ashby', slug: 'ramp' },             // 120 — was on Greenhouse (404)
  'notion': { platform: 'ashby', slug: 'notion' },         // 111 — was on Greenhouse (404)
  'plaid': { platform: 'ashby', slug: 'plaid' },           // 108 — was on Greenhouse (404)
  'benchling': { platform: 'ashby', slug: 'benchling' },   // 52  — was on Greenhouse (404)
  'linear': { platform: 'ashby', slug: 'linear' },         // 25
  'vercel': { platform: 'ashby', slug: 'vercel' },         // 0 — valid 200, empty board

  // Lever — 103 postings verified 2026-08-04
  'spotify': { platform: 'lever', slug: 'spotify' },       // 103
  // netflix and twitch were here and both 404. Netflix is no longer on Lever;
  // twitch moved to Greenhouse above. They were costing a request per scan and
  // returning nothing.
};

/**
 * Smart company search — uses known mapping if available,
 * otherwise tries all three portals in parallel
 */
export async function searchCompanyJobs(
  company: string,
  query?: string,
): Promise<PortalSearchResult> {
  const normalizedCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  const known = KNOWN_BOARDS[normalizedCompany];

  if (known) {
    switch (known.platform) {
      case 'greenhouse': return searchGreenhouse(known.slug, query);
      case 'lever': return searchLever(known.slug, query);
      case 'ashby': return searchAshby(known.slug, query);
    }
  }

  // Unknown company — try all three with the company name as slug
  return scanCompanyPortals(normalizedCompany, query);
}

// ============================================================
// SEARCH EVERY KNOWN BOARD — role-first, not company-first
// ============================================================
// The caller used to reach these boards only when the user's query literally
// contained a registered company name (`queryLower.includes(company)`), so a search
// for "data analyst" hit zero boards and fell through to a 32-listing remote feed,
// while ~2,869 verified postings sat here unreachable. People search for roles, not
// for employers they have already chosen.
//
// Each board is fetched with NO query so the per-board cache key is shared by every
// user's search, then filtered in memory. Sixteen boards populate the cache once and
// serve every query for the TTL. Filtering per board instead would mint a new cache
// entry per phrase and re-hit all sixteen APIs on every keystroke-ish search.
//
// allSettled, not all: one dead or migrated board must never empty the whole result.
// Per board, not overall. The largest board seen is 807 (Databricks); 2,000 leaves
// headroom without being unbounded, since these responses are already in memory.
const BOARD_FETCH_LIMIT = 2000;

export async function searchAllKnownBoards(
  query?: string,
  limit = 60,
): Promise<PortalSearchResult & { boardsSucceeded: number; boardsFailed: number }> {
  const entries = Object.entries(KNOWN_BOARDS);

  const settled = await Promise.allSettled(
    // BOARD_FETCH_LIMIT, not the 50 default: the adapters cap per board, and with
    // the default this fan-out returned 722 of the ~2,869 postings that exist —
    // Databricks alone posts 807, so it was losing 94% of one board. Measured, not
    // assumed: the first version of this function shipped with the default and the
    // shortfall only showed up when the totals were actually counted.
    entries.map(([, board]) => {
      switch (board.platform) {
        case 'greenhouse': return searchGreenhouse(board.slug, undefined, BOARD_FETCH_LIMIT);
        case 'lever': return searchLever(board.slug, undefined, BOARD_FETCH_LIMIT);
        case 'ashby': return searchAshby(board.slug, undefined, BOARD_FETCH_LIMIT);
      }
    }),
  );

  const all: PortalJob[] = [];
  let ok = 0;
  let failed = 0;
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) { ok++; all.push(...r.value.jobs); }
    else failed++;
  }

  // Match on title and location only. Descriptions are megabytes of boilerplate and
  // matching them turns every query into a near-universal match — "remote" appears
  // in most benefits sections. Every term must appear, so extra words narrow rather
  // than widen, which is what a searcher expects.
  const terms = (query || '').toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const matched = terms.length === 0
    ? all
    : all.filter(job => {
        const hay = `${job.title} ${job.location || ''} ${job.company || ''}`.toLowerCase();
        return terms.every(t => hay.includes(t));
      });

  return {
    jobs: matched.slice(0, limit),
    // What we are actually showing, not a market-wide estimate.
    totalCount: matched.length,
    source: `${ok} company boards`,
    company: '',
    boardsSucceeded: ok,
    boardsFailed: failed,
  };
}

// ── HTML strip utility ──
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
