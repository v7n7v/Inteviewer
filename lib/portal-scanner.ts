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
export async function searchGreenhouse(companySlug: string, query?: string): Promise<PortalSearchResult> {
  const cacheKey = `gh:${companySlug}:${query || ''}`;
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
      jobs: jobs.slice(0, 50),
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
export async function searchLever(companySlug: string, query?: string): Promise<PortalSearchResult> {
  const cacheKey = `lv:${companySlug}:${query || ''}`;
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
      jobs: jobs.slice(0, 50),
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
export async function searchAshby(companySlug: string, query?: string): Promise<PortalSearchResult> {
  const cacheKey = `ash:${companySlug}:${query || ''}`;
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
      jobs: jobs.slice(0, 50),
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
export const KNOWN_BOARDS: Record<string, { platform: 'greenhouse' | 'lever' | 'ashby'; slug: string }> = {
  // Greenhouse companies
  'stripe': { platform: 'greenhouse', slug: 'stripe' },
  'airbnb': { platform: 'greenhouse', slug: 'airbnb' },
  'coinbase': { platform: 'greenhouse', slug: 'coinbase' },
  'figma': { platform: 'greenhouse', slug: 'figma' },
  'notion': { platform: 'greenhouse', slug: 'notion' },
  'databricks': { platform: 'greenhouse', slug: 'databricks' },
  'cloudflare': { platform: 'greenhouse', slug: 'cloudflare' },
  'plaid': { platform: 'greenhouse', slug: 'plaid' },
  'discord': { platform: 'greenhouse', slug: 'discord' },
  'duolingo': { platform: 'greenhouse', slug: 'duolingo' },
  'ramp': { platform: 'greenhouse', slug: 'ramp' },
  'benchling': { platform: 'greenhouse', slug: 'benchling' },
  // Lever companies
  'netflix': { platform: 'lever', slug: 'netflix' },
  'twitch': { platform: 'lever', slug: 'twitch' },
  // Ashby companies
  'vercel': { platform: 'ashby', slug: 'vercel' },
  'linear': { platform: 'ashby', slug: 'linear' },
  'ramp-ashby': { platform: 'ashby', slug: 'ramp' },
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
