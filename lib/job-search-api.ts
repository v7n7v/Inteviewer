/**
 * Job Search API Integration
 * Provides real job listings from multiple sources
 */

export interface RealJob {
    id: string;
    title: string;
    company: string;
    location: string;
    salary: {
        min: number | null;
        max: number | null;
        currency: string;
    };
    description: string;
    skills: string[];
    url: string;
    postedDate: string;
    employmentType: string;
    source: 'jsearch' | 'adzuna' | 'remotive';
}

export interface JobSearchParams {
    query: string;
    location?: string;
    page?: number;
    numPages?: number;
    remote?: boolean;
}

export interface JobSearchResult {
    jobs: RealJob[];
    totalCount: number;
    source: string;
}

// Extract skills from job description using common tech keywords
const SKILL_KEYWORDS = [
    // Programming Languages
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'golang', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala',
    // Frontend
    'react', 'vue', 'angular', 'next.js', 'nextjs', 'svelte', 'html', 'css', 'tailwind', 'sass', 'webpack',
    // Backend
    'node.js', 'nodejs', 'express', 'django', 'flask', 'spring', 'rails', 'fastapi', 'graphql', 'rest api',
    // Databases
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'sql', 'nosql',
    // Cloud & DevOps
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'jenkins', 'ci/cd', 'github actions',
    // AI/ML
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'computer vision', 'llm', 'openai', 'langchain',
    // Data
    'data science', 'data engineering', 'spark', 'hadoop', 'airflow', 'pandas', 'numpy', 'tableau', 'power bi',
    // Mobile
    'ios', 'android', 'react native', 'flutter', 'mobile development',
    // Other
    'agile', 'scrum', 'git', 'linux', 'microservices', 'api design', 'system design', 'leadership', 'communication'
];

function extractSkillsFromDescription(description: string): string[] {
    const lowerDesc = description.toLowerCase();
    const foundSkills: string[] = [];

    for (const skill of SKILL_KEYWORDS) {
        if (lowerDesc.includes(skill.toLowerCase())) {
            // Capitalize properly
            const formatted = skill.split(' ').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            foundSkills.push(formatted);
        }
    }

    // Remove duplicates and limit to 10
    return [...new Set(foundSkills)].slice(0, 10);
}

// Parse salary from various formats
function parseSalary(salaryString: string | null | undefined): { min: number | null; max: number | null } {
    if (!salaryString) return { min: null, max: null };

    const cleanedSalary = salaryString.replace(/[$,]/g, '').toLowerCase();

    // Try to find salary ranges like "100000-150000" or "100k-150k"
    const rangeMatch = cleanedSalary.match(/(\d+\.?\d*)\s*k?\s*[-–to]+\s*(\d+\.?\d*)\s*k?/);
    if (rangeMatch) {
        let min = parseFloat(rangeMatch[1]);
        let max = parseFloat(rangeMatch[2]);

        // If values are small, they're probably in thousands
        if (min < 1000) min *= 1000;
        if (max < 1000) max *= 1000;

        return { min, max };
    }

    // Try to find single salary
    const singleMatch = cleanedSalary.match(/(\d+\.?\d*)\s*k?/);
    if (singleMatch) {
        let value = parseFloat(singleMatch[1]);
        if (value < 1000) value *= 1000;
        return { min: value, max: value };
    }

    return { min: null, max: null };
}

/**
 * JSearch API (RapidAPI) - Primary source
 * Sign up at: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 */
export async function searchJobsJSearch(params: JobSearchParams): Promise<JobSearchResult> {
    const apiKey = process.env.RAPIDAPI_KEY;

    if (!apiKey) {
        console.warn('RAPIDAPI_KEY not set, using fallback mock data');
        return { jobs: [], totalCount: 0, source: 'jsearch (no key)' };
    }

    try {
        const query = encodeURIComponent(params.query);
        const location = params.location ? encodeURIComponent(params.location) : 'USA';
        const page = params.page || 1;

        const url = `https://jsearch.p.rapidapi.com/search?query=${query}%20in%20${location}&page=${page}&num_pages=${params.numPages || 1}&date_posted=month`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-RapidAPI-Key': apiKey,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            }
        });

        if (!response.ok) {
            throw new Error(`JSearch API error: ${response.status}`);
        }

        const data = await response.json();

        const jobs: RealJob[] = (data.data || []).map((job: any) => {
            const salaryInfo = parseSalary(job.job_salary);

            return {
                id: job.job_id || crypto.randomUUID(),
                title: job.job_title || 'Unknown Title',
                company: job.employer_name || 'Unknown Company',
                location: job.job_city && job.job_state
                    ? `${job.job_city}, ${job.job_state}`
                    : job.job_country || 'Remote',
                salary: {
                    min: job.job_min_salary || salaryInfo.min,
                    max: job.job_max_salary || salaryInfo.max,
                    currency: job.job_salary_currency || 'USD'
                },
                description: job.job_description || '',
                skills: extractSkillsFromDescription(job.job_description || ''),
                url: job.job_apply_link || job.job_google_link || '#',
                postedDate: job.job_posted_at_datetime_utc || new Date().toISOString(),
                employmentType: job.job_employment_type || 'FULLTIME',
                source: 'jsearch' as const
            };
        });

        return {
            jobs,
            totalCount: data.count || jobs.length,
            source: 'JSearch API'
        };
    } catch (error) {
        console.error('JSearch API error:', error);
        return { jobs: [], totalCount: 0, source: 'jsearch (error)' };
    }
}

/**
 * Adzuna API - Alternative free source
 * Sign up at: https://developer.adzuna.com/
 */
export async function searchJobsAdzuna(params: JobSearchParams): Promise<JobSearchResult> {
    const appId = process.env.ADZUNA_APP_ID;
    const apiKey = process.env.ADZUNA_API_KEY;

    if (!appId || !apiKey) {
        console.warn('ADZUNA credentials not set');
        return { jobs: [], totalCount: 0, source: 'adzuna (no key)' };
    }

    try {
        const query = encodeURIComponent(params.query);
        const location = params.location ? encodeURIComponent(params.location) : '';
        const page = params.page || 1;

        const url = `https://api.adzuna.com/v1/api/jobs/us/search/${page}?app_id=${appId}&app_key=${apiKey}&what=${query}&where=${location}&results_per_page=20&content-type=application/json`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Adzuna API error: ${response.status}`);
        }

        const data = await response.json();

        const jobs: RealJob[] = (data.results || []).map((job: any) => ({
            id: job.id?.toString() || crypto.randomUUID(),
            title: job.title || 'Unknown Title',
            company: job.company?.display_name || 'Unknown Company',
            location: job.location?.display_name || 'Unknown Location',
            salary: {
                min: job.salary_min || null,
                max: job.salary_max || null,
                currency: 'USD'
            },
            description: job.description || '',
            skills: extractSkillsFromDescription(job.description || ''),
            url: job.redirect_url || '#',
            postedDate: job.created || new Date().toISOString(),
            employmentType: job.contract_type || 'permanent',
            source: 'adzuna' as const
        }));

        return {
            jobs,
            totalCount: data.count || jobs.length,
            source: 'Adzuna API'
        };
    } catch (error) {
        console.error('Adzuna API error:', error);
        return { jobs: [], totalCount: 0, source: 'adzuna (error)' };
    }
}

/**
 * Remotive API - Free, no key needed, remote jobs only
 * https://remotive.com/api/remote-jobs
 */
export async function searchJobsRemotive(params: JobSearchParams): Promise<JobSearchResult> {
    try {
        // Remotive only supports category search, not free text
        const url = `https://remotive.com/api/remote-jobs?limit=50`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Remotive API error: ${response.status}`);
        }

        const data = await response.json();

        // Filter by search query
        const queryLower = params.query.toLowerCase();
        const filteredJobs = (data.jobs || []).filter((job: any) =>
            job.title?.toLowerCase().includes(queryLower) ||
            job.description?.toLowerCase().includes(queryLower) ||
            job.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))
        );

        const jobs: RealJob[] = filteredJobs.slice(0, 30).map((job: any) => ({
            id: job.id?.toString() || crypto.randomUUID(),
            title: job.title || 'Unknown Title',
            company: job.company_name || 'Unknown Company',
            location: job.candidate_required_location || 'Remote',
            salary: parseSalary(job.salary) as any,
            description: job.description || '',
            skills: job.tags || extractSkillsFromDescription(job.description || ''),
            url: job.url || '#',
            postedDate: job.publication_date || new Date().toISOString(),
            employmentType: job.job_type || 'full_time',
            source: 'remotive' as const
        }));

        return {
            jobs,
            totalCount: jobs.length,
            source: 'Remotive API (Free)'
        };
    } catch (error) {
        console.error('Remotive API error:', error);
        return { jobs: [], totalCount: 0, source: 'remotive (error)' };
    }
}

/**
 * Main search function - tries multiple sources
 */
export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
    // Try JSearch first (best data quality)
    let result = await searchJobsJSearch(params);

    if (result.jobs.length > 0) {
        return result;
    }

    // Fall back to Adzuna
    result = await searchJobsAdzuna(params);

    if (result.jobs.length > 0) {
        return result;
    }

    // Fall back to Remotive (free, always works)
    result = await searchJobsRemotive(params);

    return result;
}

/**
 * Calculate fit score between user skills and job requirements
 */
export function calculateFitScore(userSkills: string[], jobSkills: string[]): number {
    if (jobSkills.length === 0) return 0.5; // Unknown requirements

    const userSkillsLower = userSkills.map(s => s.toLowerCase());
    const matchingSkills = jobSkills.filter(skill =>
        userSkillsLower.some(us => us.includes(skill.toLowerCase()) || skill.toLowerCase().includes(us))
    );

    const score = matchingSkills.length / jobSkills.length;
    return Math.min(1, Math.max(0.1, score));
}
