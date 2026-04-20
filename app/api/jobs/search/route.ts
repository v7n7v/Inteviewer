import { NextRequest, NextResponse } from 'next/server';
import { searchJobs, calculateFitScore, extractSkillsFromDescription, type JobSearchParams } from '@/lib/job-search-api';
import { semanticMatchJobs, hybridScore } from '@/lib/semantic-match';
import { searchCompanyJobs, KNOWN_BOARDS, type PortalJob } from '@/lib/portal-scanner';
import { guardApiRoute } from '@/lib/api-auth';
import { scoreAllGhostRisks } from '@/lib/ghost-filter';

export async function GET(request: NextRequest) {
    try {
        const guard = await guardApiRoute(request, { rateLimit: 15, rateLimitWindow: 60_000, allowAnonymous: true, feature: 'jdGenerations' });
        if (guard.error) return guard.error;

        const { searchParams } = new URL(request.url);

        const params: JobSearchParams = {
            query: searchParams.get('query') || 'software engineer',
            location: searchParams.get('location') || '',
            country: searchParams.get('country') || 'us',
            page: parseInt(searchParams.get('page') || '1'),
            sortBy: (searchParams.get('sortBy') as 'relevance' | 'salary' | 'date') || 'relevance',
            fullTime: searchParams.get('fullTime') === 'true',
            salaryMin: searchParams.get('salaryMin') ? parseInt(searchParams.get('salaryMin')!) : undefined,
            resultsPerPage: parseInt(searchParams.get('limit') || '20'),
        };

        // ── Parallel fetch: Adzuna + Portal Scanner (if known company detected) ──
        const queryLower = params.query.toLowerCase();
        const detectedCompany = Object.keys(KNOWN_BOARDS).find(c => queryLower.includes(c));

        const [adzunaResult, portalResult] = await Promise.allSettled([
            searchJobs(params),
            detectedCompany
                ? searchCompanyJobs(detectedCompany, queryLower.replace(detectedCompany, '').trim() || undefined)
                : Promise.resolve(null),
        ]);

        const result = adzunaResult.status === 'fulfilled' ? adzunaResult.value : { jobs: [], totalCount: 0, source: 'error' };

        // Merge portal jobs into Adzuna results (deduped by title+company)
        let portalCount = 0;
        if (portalResult.status === 'fulfilled' && portalResult.value && portalResult.value.jobs.length > 0) {
            const existingKeys = new Set(result.jobs.map(j => `${j.title.toLowerCase()}|${j.company.toLowerCase()}`));

            const portalJobs = portalResult.value.jobs
                .filter((pj: PortalJob) => !existingKeys.has(`${pj.title.toLowerCase()}|${pj.company.toLowerCase()}`))
                .map((pj: PortalJob) => ({
                    id: pj.id,
                    title: pj.title,
                    company: pj.company,
                    location: pj.location,
                    salary: { min: null, max: null, currency: 'USD' },
                    description: pj.description || '',
                    skills: [],
                    url: pj.url,
                    postedDate: pj.postedDate,
                    employmentType: 'Full-time',
                    category: pj.department,
                    source: pj.source as any,
                }));

            // Prepend portal jobs (they're fresher/direct)
            result.jobs = [...portalJobs, ...result.jobs];
            result.totalCount += portalJobs.length;
            portalCount = portalJobs.length;
        }

        // Parse user skills
        const userSkillsParam = searchParams.get('userSkills');
        let userSkills: string[] = [];
        if (userSkillsParam) {
            try { userSkills = JSON.parse(userSkillsParam); } catch { userSkills = userSkillsParam.split(','); }
        }

        const useSemantic = searchParams.get('semantic') !== 'false';

        // Phase 1: Keyword-based scoring (fast, always works)
        const jobsWithKeywordScore = result.jobs.map(job => ({
            ...job,
            keywordScore: userSkills.length > 0
                ? calculateFitScore(userSkills, job.skills, job.title)
                : null,
            matchScore: null as number | null,
            matchMethod: 'keyword' as 'keyword' | 'semantic' | 'hybrid',
        }));

        // Phase 2: Semantic scoring (Gemini embeddings)
        let matchMethod: 'keyword' | 'semantic' | 'hybrid' = 'keyword';
        if (useSemantic && userSkills.length > 0 && result.jobs.length > 0) {
            try {
                const semanticResults = await semanticMatchJobs(
                    userSkills,
                    result.jobs.map(j => ({
                        id: j.id,
                        title: j.title,
                        company: j.company,
                        description: j.description,
                        skills: j.skills,
                    })),
                    params.query,
                );

                // Apply hybrid scoring
                for (const job of jobsWithKeywordScore) {
                    const semantic = semanticResults.get(job.id);
                    if (semantic && job.keywordScore !== null) {
                        job.matchScore = hybridScore(job.keywordScore, semantic.semanticScore, 0.6);
                        job.matchMethod = 'hybrid';
                        matchMethod = 'hybrid';
                    } else {
                        job.matchScore = job.keywordScore;
                    }
                }
            } catch (err) {
                console.warn('[JobSearch] Semantic scoring failed, using keyword fallback:', err);
                // Fallback to keyword-only
                for (const job of jobsWithKeywordScore) {
                    job.matchScore = job.keywordScore;
                }
            }
        } else {
            for (const job of jobsWithKeywordScore) {
                job.matchScore = job.keywordScore;
            }
        }

        // Sort by match score if user skills provided
        if (userSkills.length > 0) {
            jobsWithKeywordScore.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        }

        // ── Ghost Job Scoring ──
        const ghostAssessments = scoreAllGhostRisks(
            jobsWithKeywordScore.map(j => ({
                title: j.title,
                company: j.company,
                postedDate: j.postedDate,
                description: j.description,
                salary: j.salary,
                url: j.url,
                location: j.location,
            }))
        );

        const jobsWithGhost = jobsWithKeywordScore.map((job, i) => ({
            ...job,
            ghostRisk: ghostAssessments[i],
        }));

        const ghostStats = {
            high: ghostAssessments.filter(g => g.risk === 'high').length,
            medium: ghostAssessments.filter(g => g.risk === 'medium').length,
            fresh: ghostAssessments.filter(g => g.fresh).length,
        };

        return NextResponse.json({
            success: true,
            jobs: jobsWithGhost,
            totalCount: result.totalCount,
            source: result.source,
            cached: result.cached || false,
            query: params.query,
            location: params.location,
            matchMethod,
            portalCount,
            portalCompany: detectedCompany || null,
            ghostStats,
        });
    } catch (error) {
        console.error('Job search error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to search jobs', jobs: [] },
            { status: 500 }
        );
    }
}
